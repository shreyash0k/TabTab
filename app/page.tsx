import { AutocompleteTextarea } from './components/AutocompleteTextarea';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          TabTab - AI Text Autocomplete
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Start typing and press <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">Tab</kbd> to accept suggestions
        </p>
        <AutocompleteTextarea placeholder="Start typing your text here..." />
      </div>
    </main>
  );
}
