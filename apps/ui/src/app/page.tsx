// A simple placeholder for your dashboard.
// In a real app, you would use the Supabase client here to fetch and display data in real-time.

async function getTasks() {
  // In a real app, this would fetch from your live API.
  // For this example, we'll just return some mock data.
  // const res = await fetch('http://localhost:8787/api/tasks');
  // if (!res.ok) return [];
  // return res.json();
  return [
    { id: 1, title: 'Setup Initial Project Structure', status: 'DONE' },
    { id: 2, title: 'Implement User Authentication', status: 'IN_PROGRESS' },
    { id: 3, title: 'Build Live Task Board', status: 'TODO' },
    { id: 4, title: 'Setup Budget Supervisor', status: 'TODO' },
  ];
}

export default async function HomePage() {
  const tasks = await getTasks();

  const statusColor = {
    DONE: 'bg-green-500',
    IN_PROGRESS: 'bg-blue-500',
    TODO: 'bg-gray-500',
  };

  return (
    <main className="container mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">devart.ai Dashboard</h1>
        <p className="text-gray-400">Live Status of AI Development Team</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Task Board Column */}
        <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Task Board</h2>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-gray-700 p-4 rounded-md flex justify-between items-center">
                <p>{task.title}</p>
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusColor[task.status as keyof typeof statusColor]}`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Service Status Column */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Service Status</h2>
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded-md">
              <h3 className="font-semibold">Premium LLM (GPT-4)</h3>
              <p className="text-sm text-gray-400">Budget: $5.20 / $50.00</p>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '10.4%' }}></div>
              </div>
            </div>
             <div className="bg-gray-700 p-4 rounded-md">
              <h3 className="font-semibold">Free LLM (Groq)</h3>
              <p className="text-sm text-gray-400">Status: Active</p>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}