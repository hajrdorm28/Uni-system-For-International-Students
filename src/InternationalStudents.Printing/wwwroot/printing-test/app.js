"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const el = {
    key: $("apiKey"), staff: $("staffId"), saveKey: $("saveKey"),
    search: $("search"), searchBtn: $("searchBtn"), rows: $("studentRows"), hint: $("listHint"),
    template: $("template"), selected: $("selectedLabel"),
    generate: $("generate"), print: $("print"), openTab: $("openTab"),
    frame: $("preview"), status: $("status"),
  };

  let selected = null;   // { id, fullName }
  let paperHtml = "";    // last generated paper

  // sessionStorage can be unavailable (privacy modes); the key then lives in the input only.
  const store = {
    get(name) { try { return sessionStorage.getItem(name) || ""; } catch { return ""; } },
    set(name, v) { try { sessionStorage.setItem(name, v); } catch { /* ignore */ } },
  };

  function say(message, isError = false) {
    el.status.textContent = message;
    el.status.classList.toggle("error", isError);
  }

  async function api(path) {
    const headers = { "X-Admin-Key": el.key.value.trim() };
    const staffId = el.staff.value.trim();
    if (staffId) headers["X-Admin-User-Id"] = staffId;
    const response = await fetch(path, { headers });
    if (!response.ok) {
      let message = `Request failed (${response.status}).`;
      try {
        const problem = await response.json();
        message = problem.detail || problem.title || message;
      } catch { /* not JSON */ }
      throw new Error(message);
    }
    return response;
  }

  function updateButtons() {
    const ready = selected !== null && !el.template.disabled;
    el.generate.disabled = !ready;
    el.print.disabled = !paperHtml;
    el.openTab.disabled = !paperHtml;
  }

  function resetPreview() {
    paperHtml = "";
    el.frame.srcdoc = "";
    updateButtons();
  }

  async function loadTemplates() {
    const templates = await (await api("/api/templates")).json();
    el.template.replaceChildren(...templates.map((t) => {
      const option = document.createElement("option");
      option.value = t.code;
      option.textContent = t.name;
      option.title = t.description;
      return option;
    }));
    el.template.disabled = false;
  }

  function renderStudents(students) {
    el.rows.replaceChildren(...students.map((s) => {
      const tr = document.createElement("tr");

      const pick = document.createElement("td");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "student";
      radio.value = String(s.id);
      radio.setAttribute("aria-label", `Select ${s.fullName}`);
      radio.checked = selected !== null && selected.id === s.id;
      radio.addEventListener("change", () => select(s, tr));
      pick.append(radio);

      const cells = [String(s.id), s.fullName, s.nationality, s.status].map((text) => {
        const td = document.createElement("td");
        td.textContent = text;           // textContent: data is never parsed as HTML
        return td;
      });
      cells[1].dir = "auto";

      tr.append(pick, ...cells);
      if (radio.checked) tr.classList.add("selected");
      return tr;
    }));
    el.hint.textContent = students.length === 0 ? "No students match." : `${students.length} student(s) shown.`;
  }

  function select(student, row) {
    selected = { id: student.id, fullName: student.fullName };
    el.rows.querySelectorAll("tr.selected").forEach((r) => r.classList.remove("selected"));
    row.classList.add("selected");
    el.selected.textContent = `Selected: ${student.fullName} (no. ${student.id})`;
    resetPreview();
    say("");
  }

  async function searchStudents() {
    say("Loading students...");
    try {
      const query = el.search.value.trim();
      const students = await (await api(`/api/students?search=${encodeURIComponent(query)}&limit=50`)).json();
      renderStudents(students);
      say("");
    } catch (error) {
      say(error.message, true);
    }
  }

  async function generate() {
    if (!selected) return;
    say("Generating paper...");
    el.generate.disabled = true;
    try {
      const response = await api(`/print/${selected.id}/${encodeURIComponent(el.template.value)}`);
      paperHtml = await response.text();
      el.frame.srcdoc = paperHtml;
      say("Paper ready (logged in print_log). Use Print to print it or save it as a PDF.");
    } catch (error) {
      resetPreview();
      say(error.message, true);
    } finally {
      updateButtons();
    }
  }

  async function useKey() {
    store.set("adminKey", el.key.value.trim());
    store.set("staffId", el.staff.value.trim());
    say("Checking key...");
    try {
      await loadTemplates();
      await searchStudents();
    } catch (error) {
      say(error.message, true);
    }
  }

  el.saveKey.addEventListener("click", useKey);
  el.key.addEventListener("keydown", (e) => { if (e.key === "Enter") useKey(); });
  el.staff.addEventListener("keydown", (e) => { if (e.key === "Enter") useKey(); });
  el.searchBtn.addEventListener("click", searchStudents);
  el.search.addEventListener("keydown", (e) => { if (e.key === "Enter") searchStudents(); });
  el.template.addEventListener("change", resetPreview);
  el.generate.addEventListener("click", generate);
  el.print.addEventListener("click", () => { el.frame.contentWindow.focus(); el.frame.contentWindow.print(); });
  el.openTab.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([paperHtml], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  el.key.value = store.get("adminKey");
  el.staff.value = store.get("staffId");
  if (el.key.value) useKey();
})();
