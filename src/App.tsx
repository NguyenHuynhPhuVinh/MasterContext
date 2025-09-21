import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  // Lớp CSS cơ bản cho các logo để tránh lặp lại
  const logoClasses = "h-24 p-6 transition-all duration-700";

  return (
    // Container chính: flexbox, căn giữa, nền sáng/tối
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Tiêu đề */}
      <h1 className="text-4xl font-bold">Welcome to Tauri + React</h1>

      {/* Hàng chứa các logo */}
      <div className="flex justify-center gap-8">
        <a href="https://vite.dev" target="_blank">
          <img
            src="/vite.svg"
            className={`${logoClasses} hover:drop-shadow-[0_0_2em_#747bff]`}
            alt="Vite logo"
          />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img
            src="/tauri.svg"
            className={`${logoClasses} hover:drop-shadow-[0_0_2em_#24c8db]`}
            alt="Tauri logo"
          />
        </a>
        <a href="https://react.dev" target="_blank">
          <img
            src={reactLogo}
            className={`${logoClasses} hover:drop-shadow-[0_0_2em_#61dafb]`}
            alt="React logo"
          />
        </a>
      </div>

      <p className="text-lg">
        Click on the Tauri, Vite, and React logos to learn more.
      </p>

      {/* Form nhập liệu */}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button
          type="submit"
          className="rounded-lg border border-transparent bg-white px-4 py-2 font-medium shadow-sm transition-colors hover:border-blue-500 dark:bg-zinc-800 dark:hover:border-sky-400"
        >
          Greet
        </button>
      </form>

      {/* Tin nhắn chào mừng */}
      <p className="mt-4 h-6 text-lg">{greetMsg}</p>
    </main>
  );
}

export default App;
