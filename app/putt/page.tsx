'use client';

import NoSSRWrapper from "@/components/NoSSRWrapper";
import Putting from "@/components/putting";


declare global {
  interface Window {
    cv: any;
  }
}

export default function Page() {
  return (
    <NoSSRWrapper>
      <Putting />
    </NoSSRWrapper>
  )
}