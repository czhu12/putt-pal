import { Results } from "./putting";

export default function StatsHeader({ results }: { results: Results }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-w-[640px] w-full text-center p-4">
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {results.loading ? "..." : results.distance.toFixed(2)}
          </span>
          <span className="text-sm ml-2">meters</span>
        </p>
        <div>Distance</div>
      </div>
      <div className="border-r-1 border-gray-300">
        <p>
          <span className="text-4xl font-bold">
            {results.loading ? "..." : results.speed.toFixed(2)}
          </span>
          <span className="text-sm ml-2">m/s</span>
        </p>
        <div>Speed</div>
      </div>
      <div>
        <p>
          <span className="text-4xl font-bold">
            {results.loading ? "..." : results.smashFactor.toFixed(2)}
          </span>
        </p>
        <div>Smash Factor</div>
      </div>
    </div>
  );
}