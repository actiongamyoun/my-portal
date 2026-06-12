"use client";

import { useEffect, useState } from "react";

type Todo = { id: number; text: string; done: boolean };
const KEY = "portal.todos.v1";

export default function TodoCard() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setTodos(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(todos));
  }, [todos, loaded]);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setTodos((p) => [{ id: Date.now(), text: t, done: false }, ...p]);
    setText("");
  };

  const remain = todos.filter((t) => !t.done).length;

  return (
    <section className="card band-green">
      <div className="card-head">
        <span className="material-icons-round">check_circle</span>
        <span className="card-title">할일</span>
        <span className="badge">{remain} 남음</span>
      </div>

      <div className="card-body">
      <div className="todo-input-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="할일 추가 후 Enter"
          aria-label="할일 입력"
        />
        <button className="icon-btn" onClick={add} aria-label="추가">
          <span className="material-icons-round">add</span>
        </button>
      </div>
      {todos.length === 0 && <p className="empty">아직 할일이 없어요. 하나 추가해 보세요.</p>}
      {todos.map((t) => (
        <div key={t.id} className={`todo${t.done ? " done" : ""}`}>
          <button
            className="check"
            onClick={() => setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
            aria-label={t.done ? "완료 해제" : "완료"}
          >
            <span className="material-icons-round">{t.done ? "check_circle" : "radio_button_unchecked"}</span>
          </button>
          <span className="todo-text">{t.text}</span>
          <button className="del" onClick={() => setTodos((p) => p.filter((x) => x.id !== t.id))} aria-label="삭제">
            <span className="material-icons-round">close</span>
          </button>
        </div>
      ))}
    </div>
    </section>
  );
}
