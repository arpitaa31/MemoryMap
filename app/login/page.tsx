"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleLogin = () => {
    if (email === "delegate@demo.com") {
      router.push("/dashboard/delegate");
    } else if (email === "chair@demo.com") {
      router.push("/dashboard/chair");
    } else if (email === "secretariat@demo.com") {
      router.push("/dashboard/admin");
    } else {
      alert("Invalid email");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-80">
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>

        <input
          type="email"
          placeholder="Enter email"
          className="w-full border p-2 rounded mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Try: delegate@demo.com / chair@demo.com / secretariat@demo.com
        </p>
      </div>
    </main>
  );
}