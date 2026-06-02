"use client";
import { ContentManager } from "@/modules/content/ContentManager";
import { CONTENT_CONFIGS } from "@/modules/content/contentConfig";
export default function TrainersPage() {
  return <ContentManager config={CONTENT_CONFIGS.trainers} />;
}
