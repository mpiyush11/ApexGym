"use client";

import type { ContentKind } from "./useContent";

export type FieldType = "text" | "textarea" | "url" | "number" | "select" | "checkbox";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  defaultValue?: string | number | boolean;
}

export interface ContentConfig {
  kind: ContentKind;
  title: string;
  singular: string;
  icon: string;
  fields: FieldDef[];
  // How to render a list row (mobile card).
  primary: (item: Record<string, unknown>) => string;
  secondary: (item: Record<string, unknown>) => string;
  imageField?: string;
  idField: string;
}

export const CONTENT_CONFIGS: Record<ContentKind, ContentConfig> = {
  trainers: {
    kind: "trainers",
    title: "Trainers",
    singular: "Trainer",
    icon: "💪",
    idField: "trainer_id",
    imageField: "trainer_photo_url",
    primary: (i) => String(i.trainer_display_name ?? ""),
    secondary: (i) => String(i.trainer_specialty ?? ""),
    fields: [
      { name: "trainer_display_name", label: "Name", type: "text", required: true, placeholder: "Trainer name" },
      { name: "trainer_specialty", label: "Specialty", type: "text", placeholder: "e.g. Strength & conditioning" },
      { name: "trainer_bio", label: "Short bio", type: "textarea", placeholder: "A line or two about them" },
      { name: "trainer_photo_url", label: "Photo URL", type: "url", placeholder: "https://…", hint: "Paste an image link" },
      { name: "is_active", label: "Show on website", type: "checkbox", defaultValue: true },
      { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
    ],
  },
  gallery: {
    kind: "gallery",
    title: "Gallery",
    singular: "Photo",
    icon: "🖼️",
    idField: "gallery_item_id",
    imageField: "image_url",
    primary: (i) => String(i.image_title ?? ""),
    secondary: (i) => String(i.area_category ?? ""),
    fields: [
      { name: "image_url", label: "Image URL", type: "url", required: true, placeholder: "https://…" },
      { name: "image_title", label: "Title", type: "text", required: true, placeholder: "e.g. Weights floor" },
      { name: "area_category", label: "Area", type: "text", required: true, placeholder: "cardio / weights / studio" },
      { name: "is_hero_gallery", label: "Use as hero image", type: "checkbox", defaultValue: false },
      { name: "is_active", label: "Show on website", type: "checkbox", defaultValue: true },
      { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
    ],
  },
  testimonials: {
    kind: "testimonials",
    title: "Testimonials",
    singular: "Testimonial",
    icon: "⭐",
    idField: "testimonial_id",
    primary: (i) => String(i.author_display_name ?? ""),
    secondary: (i) => String(i.testimonial_text ?? "").slice(0, 60),
    fields: [
      { name: "author_display_name", label: "Member name", type: "text", required: true },
      { name: "testimonial_text", label: "Testimonial", type: "textarea", required: true, placeholder: "What they said" },
      { name: "member_since_year", label: "Member since (year)", type: "number", required: true, defaultValue: new Date().getFullYear() },
      {
        name: "member_tier_key",
        label: "Tier",
        type: "select",
        defaultValue: "standard",
        options: [
          { value: "standard", label: "Standard" },
          { value: "gold", label: "Gold" },
          { value: "platinum", label: "Platinum" },
        ],
      },
      { name: "author_photo_url", label: "Photo URL (optional)", type: "url", placeholder: "https://…" },
      { name: "is_active", label: "Show on website", type: "checkbox", defaultValue: true },
      { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
    ],
  },
};
