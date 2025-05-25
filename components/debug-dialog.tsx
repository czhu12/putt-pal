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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Debug</DialogTitle>
          <DialogDescription>
            <button
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
              onClick={async () => {
                const response = await fetch('/examples/putt.webm');
                const blob = await response.blob();
                analyzeRecording(blob);
              }}
              disabled={!isReady}>
              Test Analyze
            </button>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>

  );
}