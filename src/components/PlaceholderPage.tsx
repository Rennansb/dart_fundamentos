export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-400">
        Este módulo está atualmente em desenvolvimento.
      </div>
    </div>
  );
}
