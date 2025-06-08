import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Button } from "./ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "./ui/label"
import { STIMPS, StimpKey } from "@/lib/detection/physics"
import { FormLabel } from "./ui/form"
import { FormDescription } from "./ui/form"
import { FormItem } from "./ui/form"
import { FormControl } from "./ui/form"

export interface Configuration {
  stimpLevel: StimpKey;
  alignment: boolean;
}

export default function ConfigurationOptions({ configuration, setConfiguration }: { configuration: Configuration, setConfiguration: (configuration: Configuration) => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Stimp Level: {STIMPS[configuration.stimpLevel]}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Green Settings</DialogTitle>
          <DialogDescription>
            Set up the type of green you are putting on.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <div>
              <Label htmlFor="link" className="sr-only">
                Stimp Level
              </Label>
              <Select value={configuration.stimpLevel} onValueChange={(value) => setConfiguration({ ...configuration, stimpLevel: value as StimpKey })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a stimp level" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STIMPS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{key} ({value})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label htmlFor="alignment">Show putter alignment</label>
                </div>
                <Switch
                  checked={configuration.alignment}
                  onCheckedChange={(checked) => setConfiguration({ ...configuration, alignment: checked })}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}