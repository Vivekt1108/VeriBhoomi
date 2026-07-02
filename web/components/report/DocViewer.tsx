"use client";

// Inline document viewer. Expands BELOW a document card to show the actual
// scan (PDF or image). Because the file route is auth-protected, we can't just
// point an <iframe> at it — we fetch the bytes with the Bearer token via
// apiFile() and render the resulting blob URL. The object URL is revoked on
// unmount so we don't leak memory.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, FileX } from "lucide-react";
import { apiFile } from "@/lib/api";

export function DocViewer({ documentId }: { documentId: string }) {
  const [state, setState] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    apiFile(`/api/documents/${documentId}/file`)
      .then((r) => {
        if (!alive) { URL.revokeObjectURL(r.url); return; }
        revoked = r.url;
        setState(r);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [documentId]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 overflow-hidden rounded-lg border border-ink/10 bg-ink/[0.02]"
    >
      {error ? (
        <div className="flex items-center gap-2 p-6 text-sm text-terracotta">
          <FileX className="h-4 w-4" /> This document could not be loaded.
        </div>
      ) : !state ? (
        <div className="flex items-center gap-2 p-6 text-sm text-ink-faint">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
        </div>
      ) : state.type.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.url} alt="Document scan" className="max-h-[70vh] w-full object-contain" />
      ) : (
        <iframe src={state.url} title="Document" className="h-[70vh] w-full" />
      )}
    </motion.div>
  );
}
