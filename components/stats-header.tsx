import { AppState } from "./putting";
import { PhysicsEstimate } from "@/lib/detection/physics";

function displayStraightness(degrees: number) {
  return Math.min(degrees, Math.abs(90 - degrees))
}

export default function StatsHeader({ results, appState }: { results: PhysicsEstimate | undefined, appState: AppState }) {
  const analyzing = (appState === AppState.Analyzing || !results)
  return (
    <div className="grid grid-cols-7 gap-4 max-w-[968px] w-full text-center p-4">
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {analyzing ? "..." : (results.distance * 3.28084).toFixed(2)}
          </span>
          <span className="text-sm ml-2">feet</span>
        </p>
        <div>Distance</div>
      </div>
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {analyzing ? "..." : results.speed.toFixed(2)}
          </span>
          <span className="text-sm ml-2">m/s</span>
        </p>
        <div>Ball Speed</div>
      </div>
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {analyzing ? "..." : results.metersPerSecondPutter.toFixed(2)}
          </span>
          <span className="text-sm ml-2">m/s</span>
        </p>
        <div>Putter Speed</div>
      </div>
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {analyzing ? "..." : results.smashFactor.toFixed(2)}
          </span>
        </p>
        <div>Smash Factor</div>
      </div>
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {(!analyzing && results.stroke.inferred) ? (results.stroke.distance / 10).toFixed(2) : "ERR"}
            {analyzing && "..."}
          </span>
        </p>
        <div>Backswing Distance (cm)</div>
      </div>
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {(!analyzing && results.stroke.inferred) ? (results.stroke.tempo).toFixed(2) : "ERR"}
            {analyzing && "..."}
          </span>
        </p>
        <div>Tempo</div>
      </div>
      <div>
        <p>
          <span className="text-4xl font-bold">
            {analyzing ? "..." : `${displayStraightness(results.straightness.degrees).toFixed(2)} °`}
          </span>
        </p>
        <div>Straightness</div>
      </div>
    </div>
  );
}