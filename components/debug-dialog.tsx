import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


export default function DebugDialog({ analyzeRecording, isReady }: { analyzeRecording: (blob: Blob) => void, isReady: boolean }) {
  return (
    <Dialog>
      <DialogTrigger>Open Debugger</DialogTrigger>
      <DialogContent className="min-w-4xl">
        <DialogHeader>
          <DialogTitle>Debug</DialogTitle>
          <DialogDescription>
            <span className="block overflow-auto w-full h-[400px] bg-gray-100 p-2 rounded-md block my-3 text-sm">
              <code id="debug-log">
                Logs will appear here<br/>
              </code>
            </span>
            <span className="flex gap-2 my-4 block">
              <button
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
                onClick={async () => {
                  const response = await fetch('/examples/putt-1.webm');
                  const blob = await response.blob();
                  analyzeRecording(blob);
                }}
                disabled={!isReady}>
                Analyze #1
              </button>
              <button
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
                onClick={async () => {
                  const response = await fetch('/examples/putt-2.webm');
                  const blob = await response.blob();
                  analyzeRecording(blob);
                }}
                disabled={!isReady}>
                Analyze #2
              </button>
            </span>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}