import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react";


export default function DebugDialog({ analyzeRecording, isReady }: { analyzeRecording: (blob: Blob) => void, isReady: boolean }) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  return (
    <Dialog>
      <DialogTrigger>Open Debugger</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Debug</DialogTitle>
          <DialogDescription>
            <span className="block overflow-scroll w-full h-[100px] bg-gray-100 p-2 rounded-md block my-3 text-sm max-w-xs">
              <code id="debug-log">
                Logs will appear here<br/>
              </code>
            </span>
            <span className="flex gap-2 my-4 flex-col items-center block">
              {[
                '/examples/putt-1.webm',
                '/examples/putt-10ft.webm',
                '/examples/putt-15ft.webm',
                '/examples/putt-20ft.webm',
                '/examples/putt-25ft.webm',
              ].map(url => (
                <button
                  key={url}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
                  onClick={async () => {
                    setSelectedUrl(url);
                    const response = await fetch(url);
                    const blob = await response.blob();
                    analyzeRecording(blob);
                  }}
                  disabled={!isReady}>
                  Analyze {url.split('/').pop()?.split('.').shift()} {selectedUrl === url && "🔴"}
                </button>
              ))}
            </span>
            {selectedUrl && (
              <span className="flex flex-col items-center justify-center">
                <video src={selectedUrl} autoPlay muted loop className="w-[50px]" />
                <span className="text-sm text-gray-500">
                  {selectedUrl.split('/').pop()?.split('.').shift()}
                </span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}