export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-4xl font-bold mb-12 text-gray-800">Putt Pal</h1>
      
      <div className="space-y-8 max-w-md w-full">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <p className="text-lg text-gray-700">Line up your camera facing down</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">2</div>
            <p className="text-lg text-gray-700">Move your ball into frame</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <p className="text-lg text-gray-700">Hit your putt</p>
          </div>
        </div>
      </div>

      <a href="/putt" className="mt-12 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors">
        Start
      </a>
    </div>
  );
}
