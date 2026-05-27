"""Async Firestore adapter — Motor-compatible interface.

Wraps google-cloud-firestore AsyncClient so that server.py's collection
references (find / find_one / insert_one / count_documents / delete_one /
delete_many / update_one) work unchanged when USE_FIRESTORE=true.

Supported query syntax (MongoDB subset):
  {"field": value}                   — simple equality
  {"field1": v1, "field2": v2}       — AND (chained where clauses)
  {"$or": [{"f1": v1}, {"f2": v2}]}  — OR  (two queries merged in-memory)

Projection arguments are accepted but ignored (Firestore always returns
the full document).
"""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import Any, Dict, List, Optional

from google.cloud import firestore as fs
from google.cloud.firestore_v1.base_query import FieldFilter


# ── Client construction ───────────────────────────────────────────────────────

def _build_async_client() -> fs.AsyncClient:
    """
    Build an async Firestore client.

    Auth resolution (in priority order):
      1. GOOGLE_APPLICATION_CREDENTIALS env var → service account JSON path
      2. Application Default Credentials (ADC) — automatic on GCP Cloud Run /
         GCE, or locally after `gcloud auth application-default login`.

    Project resolution:
      GOOGLE_CLOUD_PROJECT env var (required locally; usually inferred on GCP).
    """
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or None
    database = os.environ.get("FIRESTORE_DATABASE", "aistethf3")
    # google-cloud-firestore picks up GOOGLE_APPLICATION_CREDENTIALS
    # automatically via google-auth; no extra handling needed here.
    return fs.AsyncClient(project=project, database=database)


# ── Internal helpers ─────────────────────────────────────────────────────────

class _Result:
    """Lightweight result object mirroring Motor's DeleteResult / UpdateResult."""

    def __init__(self, count: int = 0, upserted_id: Any = None):
        self.deleted_count = count
        self.modified_count = count
        self.upserted_id = upserted_id


def _apply_query(
    col_ref: fs.AsyncCollectionReference,
    query: Dict[str, Any],
) -> List[fs.AsyncCollectionReference]:
    """
    Convert a MongoDB-style filter dict into a list of Firestore query objects.
    Returns a list so that $or can be represented as multiple queries.
    """
    if not query:
        return [col_ref]

    if "$or" in query:
        result = []
        for branch in query["$or"]:
            q = col_ref
            for field, value in branch.items():
                q = q.where(filter=FieldFilter(field, "==", value))
            result.append(q)
        return result

    q = col_ref
    for field, value in query.items():
        q = q.where(filter=FieldFilter(field, "==", value))
    return [q]


async def _fetch_all(
    queries: List,
    sort_field: Optional[str] = None,
    sort_dir: int = -1,          # -1 = descending, 1 = ascending
    skip_n: int = 0,
    limit_n: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Execute queries concurrently, merge + deduplicate, then sort/page."""
    # Run all queries in parallel
    results = await asyncio.gather(*[q.get() for q in queries])

    seen: set = set()
    docs: List[Dict[str, Any]] = []
    for snaps in results:
        for snap in snaps:
            d = snap.to_dict()
            if d is None:
                continue
            doc_id = d.get("id", snap.id)
            if doc_id not in seen:
                seen.add(doc_id)
                docs.append(d)

    if sort_field:
        docs.sort(
            key=lambda x: (x.get(sort_field) or ""),
            reverse=(sort_dir == -1),
        )

    if skip_n:
        docs = docs[skip_n:]
    if limit_n is not None:
        docs = docs[:limit_n]

    return docs


# ── Cursor ───────────────────────────────────────────────────────────────────

class FirestoreCursor:
    """Chainable async cursor returned by FirestoreCollection.find()."""

    def __init__(self, queries: List):
        self._queries = queries
        self._sort_field: Optional[str] = None
        self._sort_dir: int = -1
        self._skip_n: int = 0
        self._limit_n: Optional[int] = None

    # -- Chaining methods (return self for fluent API) --

    def sort(self, field: str, direction: int = -1) -> "FirestoreCursor":
        self._sort_field = field
        self._sort_dir = direction
        return self

    def skip(self, n: int) -> "FirestoreCursor":
        self._skip_n = max(0, n)
        return self

    def limit(self, n: int) -> "FirestoreCursor":
        self._limit_n = n
        return self

    # -- Consumption --

    async def _fetch(self) -> List[Dict[str, Any]]:
        return await _fetch_all(
            self._queries,
            sort_field=self._sort_field,
            sort_dir=self._sort_dir,
            skip_n=self._skip_n,
            limit_n=self._limit_n,
        )

    def __aiter__(self):
        return self._aiter()

    async def _aiter(self):
        for doc in await self._fetch():
            yield doc

    async def to_list(self, n: Optional[int] = None) -> List[Dict[str, Any]]:
        docs = await self._fetch()
        return docs[:n] if n is not None else docs


# ── Collection ───────────────────────────────────────────────────────────────

class FirestoreCollection:
    """
    Async Firestore collection wrapper with a Motor-compatible API.

    All methods that Motor exposes as coroutines are coroutines here.
    find() returns a FirestoreCursor (chainable, async-iterable).
    """

    def __init__(self, client: fs.AsyncClient, name: str):
        self._client = client
        self._col: fs.AsyncCollectionReference = client.collection(name)

    # -- Write --

    async def insert_one(self, doc: Dict[str, Any]) -> None:
        doc_id = str(doc.get("id") or uuid.uuid4())
        await self._col.document(doc_id).set(doc)

    async def update_one(
        self,
        filter_query: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False,
    ) -> _Result:
        """Supports {"$set": {...}} update syntax."""
        data: Dict[str, Any] = update.get("$set", update)

        # Direct ID lookup optimisation
        if list(filter_query.keys()) == ["id"]:
            ref = self._col.document(str(filter_query["id"]))
            snap = await ref.get()
            if snap.exists:
                await ref.update(data)
                return _Result(1)
            if upsert:
                await ref.set(data)
                return _Result(1, upserted_id=filter_query["id"])
            return _Result(0)

        docs = await _fetch_all(_apply_query(self._col, filter_query), limit_n=1)
        if docs:
            doc_id = str(docs[0].get("id", ""))
            if doc_id:
                await self._col.document(doc_id).update(data)
                return _Result(1)
        if upsert:
            doc_id = str(data.get("id") or uuid.uuid4())
            await self._col.document(doc_id).set(data)
            return _Result(1, upserted_id=doc_id)
        return _Result(0)

    async def delete_one(self, filter_query: Dict[str, Any]) -> _Result:
        # Direct ID lookup optimisation
        if list(filter_query.keys()) == ["id"]:
            ref = self._col.document(str(filter_query["id"]))
            snap = await ref.get()
            if snap.exists:
                await ref.delete()
                return _Result(1)
            return _Result(0)

        docs = await _fetch_all(_apply_query(self._col, filter_query), limit_n=1)
        if not docs:
            return _Result(0)
        doc_id = str(docs[0].get("id", ""))
        if doc_id:
            await self._col.document(doc_id).delete()
            return _Result(1)
        return _Result(0)

    async def delete_many(self, filter_query: Dict[str, Any]) -> _Result:
        docs = await _fetch_all(_apply_query(self._col, filter_query))
        if not docs:
            return _Result(0)

        # Batch delete (Firestore max 500 ops per batch)
        count = 0
        BATCH_SIZE = 490
        for i in range(0, len(docs), BATCH_SIZE):
            batch = self._client.batch()
            for d in docs[i : i + BATCH_SIZE]:
                doc_id = d.get("id")
                if doc_id:
                    batch.delete(self._col.document(str(doc_id)))
                    count += 1
            await batch.commit()
        return _Result(count)

    # -- Read --

    def find(
        self,
        filter_query: Optional[Dict[str, Any]] = None,
        projection: Any = None,  # accepted, ignored
    ) -> FirestoreCursor:
        return FirestoreCursor(_apply_query(self._col, filter_query or {}))

    async def find_one(
        self,
        filter_query: Dict[str, Any],
        projection: Any = None,   # accepted, ignored
        sort: Optional[List] = None,
    ) -> Optional[Dict[str, Any]]:
        sort_field: Optional[str] = None
        sort_dir: int = -1

        if sort:
            # Motor-style: sort=[("field", direction)]
            if isinstance(sort, list) and sort:
                sort_field, sort_dir = sort[0]

        # Direct ID lookup optimisation
        if list(filter_query.keys()) == ["id"] and sort is None:
            snap = await self._col.document(str(filter_query["id"])).get()
            return snap.to_dict() if snap.exists else None

        docs = await _fetch_all(
            _apply_query(self._col, filter_query),
            sort_field=sort_field,
            sort_dir=sort_dir,
            limit_n=1,
        )
        return docs[0] if docs else None

    async def count_documents(self, filter_query: Dict[str, Any]) -> int:
        queries = _apply_query(self._col, filter_query)
        results = await asyncio.gather(*[q.get() for q in queries])
        seen: set = set()
        for snaps in results:
            for snap in snaps:
                d = snap.to_dict()
                if d is None:
                    continue
                seen.add(d.get("id", snap.id))
        return len(seen)


# ── Database ─────────────────────────────────────────────────────────────────

class FirestoreDB:
    """Provides collection access, mirroring AsyncIOMotorDatabase."""

    def __init__(self, client: fs.AsyncClient):
        self._client = client
        self._cols: Dict[str, FirestoreCollection] = {}

    def __getitem__(self, name: str) -> FirestoreCollection:
        if name not in self._cols:
            self._cols[name] = FirestoreCollection(self._client, name)
        return self._cols[name]

    async def close(self) -> None:
        await self._client.close()


def get_firestore_db() -> FirestoreDB:
    """Build and return a FirestoreDB instance ready for use."""
    return FirestoreDB(_build_async_client())
