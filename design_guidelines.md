{
  "brand": {
    "name": "AiSteth",
    "attributes": [
      "clinical-grade",
      "premium",
      "trustworthy",
      "calm precision",
      "instrument-like dark UI",
      "low-friction onboarding"
    ],
    "visual_metaphors": [
      "cardiac waveform lines",
      "soft red pulse accent",
      "deep navy instrument panels",
      "glass-like panels (but NOT transparent backgrounds)"
    ]
  },
  "direction": {
    "mode": "dark-only",
    "rationale": "A rich dark UI reads like a clinical instrument panel, reduces glare during camera use, and supports premium health-tech positioning. Use layered dark surfaces (not pure black) with high-contrast typography and a restrained soft-red accent for cardiac emphasis.",
    "gradient_policy": {
      "allowed": "Only as subtle section background accents (hero/top band) and decorative overlays. Keep under 20% viewport.",
      "forbidden": "No saturated/dark gradients (purple/pink, blue→purple, etc). No gradients on small elements (<100px). No gradients behind text-heavy reading areas.",
      "fallback": "If readability drops or gradient area exceeds 20% viewport, use solid surfaces."
    },
    "no_transparency_rule": "Do not use transparent backgrounds for cards/modals. Use solid dark surfaces with subtle borders and shadows to imply depth."
  },
  "palette": {
    "notes": "Deep navy base + cool slate neutrals + soft red pulse accent. Avoid purple. Ensure WCAG AA contrast for text and key UI.",
    "hex": {
      "bg": "#070B14",
      "bg_2": "#0B1220",
      "surface": "#0F1A2B",
      "surface_2": "#121F33",
      "border": "#22324A",
      "text": "#EAF0FF",
      "text_muted": "#A9B6D3",
      "text_subtle": "#7F8FB2",
      "primary": "#EAF0FF",
      "primary_fg": "#0B1220",
      "accent_pulse": "#FF4D5E",
      "accent_pulse_2": "#FF7A86",
      "info": "#4CC3FF",
      "success": "#2FE6B8",
      "warning": "#FFCC66",
      "danger": "#FF4D5E",
      "focus_ring": "#4CC3FF"
    },
    "semantic_tokens_hsl_for_shadcn": {
      "implementation_note": "Update /app/frontend/src/index.css :root and .dark tokens to match this dark-only system. Prefer setting html class=\"dark\" permanently.",
      "dark": {
        "--background": "222 55% 6%",
        "--foreground": "220 60% 96%",
        "--card": "220 45% 12%",
        "--card-foreground": "220 60% 96%",
        "--popover": "220 45% 12%",
        "--popover-foreground": "220 60% 96%",
        "--primary": "220 60% 96%",
        "--primary-foreground": "220 45% 12%",
        "--secondary": "220 30% 18%",
        "--secondary-foreground": "220 60% 96%",
        "--muted": "220 25% 18%",
        "--muted-foreground": "220 20% 72%",
        "--accent": "220 30% 18%",
        "--accent-foreground": "220 60% 96%",
        "--destructive": "354 100% 65%",
        "--destructive-foreground": "220 60% 96%",
        "--border": "218 35% 22%",
        "--input": "218 35% 22%",
        "--ring": "198 100% 65%",
        "--radius": "0.9rem"
      }
    },
    "gradients": {
      "bg_top_band": {
        "css": "radial-gradient(900px circle at 20% -10%, rgba(76,195,255,0.18), rgba(7,11,20,0) 55%), radial-gradient(700px circle at 85% 0%, rgba(255,77,94,0.14), rgba(7,11,20,0) 52%)",
        "usage": "Only for the top 160–220px of onboarding page background (decorative)."
      },
      "pulse_glow": {
        "css": "radial-gradient(220px circle at 50% 50%, rgba(255,77,94,0.22), rgba(255,77,94,0) 70%)",
        "usage": "Behind the primary CTA area (large container only)."
      }
    },
    "texture": {
      "noise_overlay": {
        "css": "background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E');",
        "usage": "Apply to page background wrapper only (not cards). Keep opacity <= 0.08."
      }
    }
  },
  "typography": {
    "font_pairing": {
      "display": {
        "name": "Space Grotesk",
        "google_fonts": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
        "usage": "Brand wordmark, H1/H2, stat numbers"
      },
      "body": {
        "name": "IBM Plex Sans",
        "google_fonts": "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap",
        "usage": "Body, labels, consent copy"
      },
      "mono_optional": {
        "name": "IBM Plex Mono",
        "google_fonts": "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap",
        "usage": "Timestamps, scan IDs (optional)"
      }
    },
    "tailwind_usage": {
      "note": "Set font-family in index.css body and add utility classes via Tailwind config if needed; otherwise use inline style/className with font-[...] via arbitrary values.",
      "scale": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
        "h2": "text-base md:text-lg text-muted-foreground",
        "section_title": "text-lg font-semibold tracking-tight",
        "card_title": "text-sm font-medium text-foreground",
        "body": "text-sm md:text-base text-foreground/90 leading-relaxed",
        "small": "text-xs text-muted-foreground"
      }
    }
  },
  "layout": {
    "grid": {
      "container": "max-w-6xl mx-auto px-4 sm:px-6",
      "page_vertical_rhythm": "py-6 sm:py-10",
      "desktop_split": "Onboarding uses a 12-col grid on lg: left narrative (7 cols) + right step card (5 cols). Mobile is single column.",
      "history_grid": "Stats row: 1 col mobile, 3 cols md+. Scan cards: 1 col mobile, 2 cols md, 3 cols xl."
    },
    "spacing": {
      "principle": "Use 2–3x more spacing than feels comfortable. Prefer whitespace over borders.",
      "tokens": {
        "--space-1": "4px",
        "--space-2": "8px",
        "--space-3": "12px",
        "--space-4": "16px",
        "--space-5": "24px",
        "--space-6": "32px",
        "--space-7": "48px"
      }
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui",
      "use": [
        "button.jsx",
        "card.jsx",
        "badge.jsx",
        "progress.jsx",
        "separator.jsx",
        "dialog.jsx",
        "drawer.jsx (mobile detail view)",
        "skeleton.jsx",
        "alert.jsx",
        "checkbox.jsx",
        "tabs.jsx",
        "scroll-area.jsx",
        "tooltip.jsx",
        "sonner.jsx"
      ]
    },
    "header": {
      "structure": "Sticky top app header with brand mark left, nav right. On mobile: brand + 2 icon-ish buttons (Scan, History).",
      "shadcn": ["navigation-menu.jsx (optional)", "button.jsx", "separator.jsx"],
      "styles": {
        "wrapper": "sticky top-0 z-40 border-b bg-[color:var(--bg-2)]/?? (NO transparency) bg-[#0B1220]",
        "inner": "max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between",
        "brand": "flex items-center gap-2 font-semibold tracking-tight",
        "brand_mark": "w-8 h-8 rounded-xl bg-[#121F33] border border-[#22324A] grid place-items-center"
      },
      "data_testids": {
        "scan_button": "app-header-scan-button",
        "history_button": "app-header-history-button",
        "brand_link": "app-header-brand-link"
      }
    },
    "step_indicator": {
      "inspiration": "USWDS step indicator guidance: distinct current vs complete vs pending; aria-current; short labels; heading below indicator.",
      "implementation": {
        "shadcn": ["progress.jsx", "badge.jsx"],
        "pattern": "Top row: segmented mini-steps (3 dots/segments) + 'Step X of 3' counter. Under it: step title as H3.",
        "tailwind": {
          "segments": "flex items-center gap-2",
          "segment": "h-1.5 flex-1 rounded-full bg-[#22324A]",
          "segment_complete": "bg-[#4CC3FF]",
          "segment_current": "bg-[#EAF0FF]",
          "counter": "text-xs text-[#A9B6D3]"
        },
        "a11y": {
          "aria_current": "Set aria-current=\"step\" on current step button/label if clickable; if not clickable, use aria-current on the current segment wrapper.",
          "sr_text": "Include visually hidden completion status for screen readers."
        }
      },
      "data_testids": {
        "wrapper": "onboarding-step-indicator",
        "next": "onboarding-next-button",
        "back": "onboarding-back-button"
      }
    },
    "cards": {
      "rule": "Cards are solid surfaces (no transparency). Use subtle border + soft shadow for depth.",
      "base_class": "rounded-2xl bg-[#0F1A2B] border border-[#22324A] shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
      "hover": "hover:border-[#2E4668] hover:shadow-[0_14px_40px_rgba(0,0,0,0.45)]",
      "motion": "transition-[box-shadow,border-color] duration-200"
    },
    "buttons": {
      "style": "Professional / clinical premium. Medium radius, strong focus ring, subtle press scale.",
      "variants": {
        "primary": {
          "class": "bg-[#EAF0FF] text-[#0B1220] hover:bg-white transition-[background-color,box-shadow]",
          "shadow": "shadow-[0_10px_24px_rgba(234,240,255,0.10)]"
        },
        "secondary": {
          "class": "bg-[#121F33] text-[#EAF0FF] border border-[#22324A] hover:bg-[#162742] transition-[background-color,border-color]"
        },
        "danger": {
          "class": "bg-[#FF4D5E] text-[#070B14] hover:bg-[#FF7A86] transition-[background-color]"
        },
        "ghost": {
          "class": "bg-transparent text-[#EAF0FF] hover:bg-[#121F33] transition-[background-color]"
        }
      },
      "sizes": {
        "cta": "h-12 px-5 text-base rounded-xl",
        "md": "h-10 px-4 rounded-lg",
        "sm": "h-9 px-3 rounded-lg"
      },
      "interaction": {
        "press": "active:scale-[0.98]",
        "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CC3FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B14]"
      }
    },
    "badges_and_chips": {
      "use": "Vitals chips (HR, HRV, SpO₂, Resp) and status labels.",
      "shadcn": ["badge.jsx"],
      "classes": {
        "chip": "rounded-full px-2.5 py-1 text-xs bg-[#121F33] border border-[#22324A] text-[#EAF0FF]",
        "chip_muted": "text-[#A9B6D3]",
        "chip_pulse": "border-[#FF4D5E]/?? (avoid transparency) use border-[#FF4D5E] and bg-[#1A1F2E]"
      },
      "data_testids": {
        "vital_chip": "scan-detail-vital-chip"
      }
    },
    "stat_tiles": {
      "pattern": "3 tiles: Total scans, Latest HR, Latest SpO₂ (or HRV). Each tile has label, big number, small delta/updated time.",
      "shadcn": ["card.jsx"],
      "classes": {
        "tile": "rounded-2xl bg-[#0F1A2B] border border-[#22324A] p-4 sm:p-5",
        "label": "text-xs text-[#A9B6D3]",
        "value": "mt-2 text-2xl font-semibold tracking-tight",
        "meta": "mt-1 text-xs text-[#7F8FB2]"
      }
    },
    "history_scan_card": {
      "pattern": "Clickable card with date/time, vitals chips row, and a right-side chevron. Entire card is a button for mobile ergonomics.",
      "shadcn": ["card.jsx", "badge.jsx"],
      "classes": {
        "card": "group rounded-2xl bg-[#0F1A2B] border border-[#22324A] p-4 sm:p-5 text-left",
        "hover": "hover:border-[#2E4668] transition-[border-color,box-shadow]",
        "title": "text-sm font-medium",
        "sub": "mt-1 text-xs text-[#A9B6D3]",
        "chips": "mt-3 flex flex-wrap gap-2"
      },
      "data_testids": {
        "card": "history-scan-card",
        "open": "history-scan-open-button"
      }
    },
    "detail_modal": {
      "pattern": "Desktop: Dialog. Mobile: Drawer. Tabs inside: Overview | QRISK3 | Narrative | Wearable Compare.",
      "shadcn": ["dialog.jsx", "drawer.jsx", "tabs.jsx", "scroll-area.jsx", "separator.jsx"],
      "classes": {
        "panel": "rounded-2xl bg-[#0F1A2B] border border-[#22324A]",
        "header": "p-4 sm:p-5 border-b border-[#22324A]",
        "content": "p-4 sm:p-5",
        "tabs": "mt-3"
      },
      "data_testids": {
        "modal": "scan-detail-modal",
        "close": "scan-detail-close-button",
        "tab_overview": "scan-detail-tab-overview",
        "tab_qrisk": "scan-detail-tab-qrisk",
        "tab_narrative": "scan-detail-tab-narrative",
        "tab_compare": "scan-detail-tab-compare"
      }
    },
    "empty_state": {
      "pattern": "Centered within content column (not whole page). Includes icon, headline, short copy, primary CTA.",
      "shadcn": ["card.jsx", "button.jsx"],
      "classes": {
        "wrap": "rounded-2xl bg-[#0F1A2B] border border-[#22324A] p-6 sm:p-8",
        "title": "text-lg font-semibold",
        "copy": "mt-2 text-sm text-[#A9B6D3]",
        "cta": "mt-5"
      },
      "data_testids": {
        "cta": "history-empty-start-scan-button"
      }
    },
    "loading_and_errors": {
      "loading": {
        "shadcn": ["skeleton.jsx"],
        "pattern": "Skeleton tiles for stats + skeleton list for scan cards."
      },
      "errors": {
        "shadcn": ["alert.jsx", "sonner.jsx"],
        "pattern": "Inline Alert for blocking errors; Sonner toast for transient errors."
      },
      "data_testids": {
        "error_alert": "app-error-alert",
        "loading": "app-loading-skeleton"
      }
    }
  },
  "motion": {
    "library": {
      "name": "framer-motion",
      "install": "npm i framer-motion",
      "usage": "Onboarding step transitions, modal entrance, subtle list item reveal. Respect prefers-reduced-motion."
    },
    "principles": [
      "Subtle, premium motion: 160–220ms for hover, 240–320ms for panel transitions",
      "Use easing: cubic-bezier(0.2, 0.8, 0.2, 1)",
      "No universal transition: never transition: all",
      "Avoid large parallax; keep micro depth shifts only"
    ],
    "recipes": {
      "step_panel": {
        "initial": "{ opacity: 0, y: 10 }",
        "animate": "{ opacity: 1, y: 0 }",
        "exit": "{ opacity: 0, y: -10 }",
        "transition": "{ duration: 0.28, ease: [0.2,0.8,0.2,1] }"
      },
      "card_hover": {
        "css": "hover:-translate-y-0.5 transition-transform duration-200",
        "note": "Only apply transform transition on the element that transforms."
      }
    }
  },
  "pages": {
    "/": {
      "name": "Onboarding",
      "layout": {
        "background": "Use bg_top_band gradient only at top + noise overlay on page wrapper.",
        "structure": [
          "Header (sticky)",
          "Hero intro (left narrative) + Step card (right) on desktop",
          "Mobile: hero intro above step card"
        ]
      },
      "step_1_welcome": {
        "content": {
          "headline": "Camera-based cardiac assessment in 60 seconds",
          "support": "Explain: face scan first; finger scan only if needed. Emphasize privacy + clinical intent.",
          "cta": "Continue"
        },
        "ui": {
          "left_panel": "Brand mark + short bullets (3 max) with icons (lucide-react).",
          "right_card": "Step indicator + step title + short copy + primary button."
        },
        "data_testids": {
          "continue": "onboarding-welcome-continue-button"
        }
      },
      "step_2_consent": {
        "content": {
          "headline": "Consent & medical disclaimer",
          "pattern": "Use collapsible sections for readability: 'Not a diagnosis', 'Data use', 'Camera requirements'.",
          "checkbox": "I understand and consent"
        },
        "ui": {
          "disclaimer": "Use Alert component with info styling (not destructive). Keep tone calm.",
          "checkbox": "Large tap target; label wraps; link to privacy policy."
        },
        "data_testids": {
          "consent_checkbox": "onboarding-consent-checkbox",
          "privacy_link": "onboarding-privacy-policy-link"
        }
      },
      "step_3_camera_primer": {
        "content": {
          "headline": "Camera permission primer",
          "bullets": [
            "Good lighting, steady phone",
            "Remove glasses if reflections",
            "Keep face centered"
          ],
          "cta": "Start scan"
        },
        "handoff": {
          "action": "Navigate to /aisteth.html",
          "note": "This is a full-page static scan UI outside React scope."
        },
        "data_testids": {
          "start_scan": "onboarding-start-scan-button"
        }
      }
    },
    "/history": {
      "name": "History Dashboard",
      "layout": {
        "top": "Title row: 'History' + primary 'New scan' button.",
        "stats": "3 stat tiles.",
        "list": "Scan cards grid with filters row (optional): date range, sort. Keep minimal."
      },
      "scan_page_back_affordance": {
        "requirement": "On /aisteth.html include a tasteful ← Back that returns to /history.",
        "design": {
          "placement": "Top-left, inside safe area",
          "style": "Ghost button with icon + label 'Back to History'",
          "data_testid": "scan-page-back-to-history-button"
        }
      },
      "detail": {
        "open": "Click scan card opens modal/drawer.",
        "sections": [
          "Overview: vitals chips + scan quality + notes",
          "QRISK3: score + interpretation band",
          "AI narrative: scrollable text block",
          "Wearable compare: side-by-side table"
        ]
      },
      "data_testids": {
        "new_scan": "history-new-scan-button",
        "stats_total": "history-stats-total-scans",
        "stats_latest_hr": "history-stats-latest-hr",
        "stats_latest_spo2": "history-stats-latest-spo2"
      }
    }
  },
  "data_viz": {
    "optional": {
      "library": "recharts",
      "install": "npm i recharts",
      "use_cases": [
        "Tiny sparkline in stat tiles (latest HR trend)",
        "QRISK3 risk band visualization"
      ],
      "style": "Use muted gridlines (#22324A) and one accent color at a time (info blue or pulse red)."
    }
  },
  "image_urls": {
    "decorative_backgrounds": [
      {
        "url": "https://images.unsplash.com/photo-1557683316-973673baf926?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxjbGluaWNhbCUyMGRhcmslMjBkYXNoYm9hcmQlMjBhYnN0cmFjdCUyMGdyYWRpZW50JTIwYmFja2dyb3VuZHxlbnwwfHx8Ymx1ZXwxNzc4ODU3MjU3fDA&ixlib=rb-4.1.0&q=85",
        "category": "onboarding-hero-top-band",
        "description": "Use as a subtle blurred background image behind the top band only (max 160–220px height). Apply blur + low opacity via CSS; do not place behind long text."
      },
      {
        "url": "https://images.unsplash.com/photo-1557683304-673a23048d34?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwzfHxjbGluaWNhbCUyMGRhcmslMjBkYXNoYm9hcmQlMjBhYnN0cmFjdCUyMGdyYWRpZW50JTIwYmFja2dyb3VuZHxlbnwwfHx8Ymx1ZXwxNzc4ODU3MjU3fDA&ixlib=rb-4.1.0&q=85",
        "category": "history-header-accent",
        "description": "Optional: very subtle background accent behind History title row only. Keep opacity low and ensure text contrast."
      }
    ]
  },
  "accessibility": {
    "requirements": [
      "WCAG 2.1 AA contrast for text and UI controls",
      "Visible focus states on all interactive elements",
      "Large tap targets: min 44x44px",
      "Use aria-current for step indicator current step",
      "Respect prefers-reduced-motion (disable large transitions)"
    ],
    "content_tone": {
      "disclaimer": "Prominent but calm: avoid alarming language; use 'This is not a diagnosis' and 'For informational use'."
    }
  },
  "instructions_to_main_agent": {
    "global": [
      "Set app to dark-only by applying className=\"dark\" on <html> or <body> and updating shadcn tokens in /app/frontend/src/index.css accordingly.",
      "Do NOT use transparent backgrounds for cards/modals; use solid surfaces (#0F1A2B etc).",
      "Implement onboarding as a 3-step state machine with Framer Motion transitions and a step indicator.",
      "All interactive and key informational elements MUST include data-testid attributes (kebab-case, role-based).",
      "Use shadcn components from /app/frontend/src/components/ui (Button, Card, Badge, Dialog/Drawer, Tabs, Skeleton, Alert, Checkbox, Sonner).",
      "Add a clear 'Back to History' ghost button on /aisteth.html (static page) that navigates to /history."
    ],
    "suggested_routes": [
      "/ (Onboarding)",
      "/history (Dashboard)",
      "/aisteth.html (external scan UI; only add back affordance)"
    ]
  }
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
