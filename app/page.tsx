export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800">MUNFlow</h1>
        <p className="mt-2 text-gray-600">
          From registration to resolution.
        </p>

        <a
          href="/login"
          className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Get Started
        </a>
      </div>
    </main>
  );
}