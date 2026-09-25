---
version: alpha
name: Go2Market Neutral
description: Neutral sample theme for Go2Market Tab. Replace it with your company DESIGN.md.
colors:
  background: "#F6F7F9"
  surface: "#FFFFFF"
  text: "#1B1F24"
  text-muted: "#57606A"
  primary: "#2F5BD3"
  on-primary: "#FFFFFF"
  border: "#D8DDE3"
  secondary: "#0E7C66"
  tertiary: "#8A4FBF"
  error: "#C4312B"
  warning: "#9A6700"
  success: "#1A7F37"
  background-dark: "#16191D"
  surface-dark: "#1F2328"
  text-dark: "#E8EBEF"
  text-muted-dark: "#9EA7B3"
  primary-dark: "#7FA2FF"
  on-primary-dark: "#0B1A3A"
  border-dark: "#343A42"
  secondary-dark: "#4CC3A5"
  tertiary-dark: "#C39BEA"
typography:
  headline-md:
    fontFamily: system-ui
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
  title-sm:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.06em
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  panel-title:
    typography: "{typography.label-sm}"
    textColor: "{colors.text-muted}"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
  chip:
    rounded: "{rounded.full}"
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---

# Go2Market Neutral

## Overview

A calm, neutral theme. It keeps the focus on the content. It uses the system font, so it makes no font requests.

## Colors

- **Background (#F6F7F9):** the page color.
- **Surface (#FFFFFF):** panels.
- **Text (#1B1F24) and Text muted (#57606A):** body text and metadata.
- **Primary (#2F5BD3):** links, focus rings and the copy button.
- **Dark tokens:** each color with the `-dark` suffix is the dark mode value.

## Typography

System font for all text. Titles use weight 600. Labels use small caps spacing.

## Shapes

Small radius on chips and buttons, medium on cards, large on panels.
