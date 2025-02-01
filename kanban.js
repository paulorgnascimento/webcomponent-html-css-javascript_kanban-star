class KanbanBoard extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const meta = document.createElement('meta');
    meta.setAttribute('charset', 'UTF-8');
    shadow.appendChild(meta);
    this.problems = [];
  }

  connectedCallback() {
    this.render();
    this.initializeEventListeners();
    this.loadInitialState();
  }

  render() {
    const style = `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.5;
        color: #24292e;
        padding: 20px;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .form-group {
        margin-bottom: 16px;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .input-field {
        padding: 8px;
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        font-size: 14px;
        flex: 1;
        min-width: 200px;
      }

      .button {
        background-color: #4a90e2;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .button:hover {
        background-color: #357abd;
      }

      .board {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }

      .column {
        background: #f6f8fa;
        border-radius: 6px;
        padding: 16px;
      }

      .column-header {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
      }

      .kanban-items {
        min-height: 400px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .task {
        background: #ffffff;
        padding: 12px;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        cursor: move;
        user-select: none;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .task:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
      }

      .task.dragging {
        opacity: 0.5;
      }

      .actions {
        display: flex;
        gap: 8px;
        margin: 16px 0;
      }
    `;

    const html = `
      <div class="container">
        <div class="form-group">
          <input type="text" id="problem" class="input-field" placeholder="Situação/Problema" />
          <input type="text" id="expectedResult" class="input-field" placeholder="Resultado Esperado" />
          <button id="addProblem" class="button">Cadastrar Situação</button>
        </div>

        <div class="form-group">
          <input type="text" id="taskInput" class="input-field" placeholder="Nova Tarefa" />
          <select id="situationDropdown" class="input-field">
            <option value="" disabled selected>Selecione uma Situação</option>
          </select>
          <button id="addTask" class="button">Criar Tarefa</button>
        </div>

        <div class="actions">
          <button id="exportCsv" class="button">Exportar CSV</button>
          <input type="file" id="importCsv" accept=".csv" hidden />
          <button id="importButton" class="button">Importar CSV</button>
        </div>

        <div class="board">
          <div class="column" data-column="To Do">
            <h3 class="column-header">To Do</h3>
            <div class="kanban-items"></div>
          </div>
          <div class="column" data-column="In Progress">
            <h3 class="column-header">In Progress</h3>
            <div class="kanban-items"></div>
          </div>
          <div class="column" data-column="Done">
            <h3 class="column-header">Done</h3>
            <div class="kanban-items"></div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      ${html}
    `;
  }

  initializeEventListeners() {
    this.shadowRoot.getElementById('addProblem').addEventListener('click', () => this.handleAddProblem());
    this.shadowRoot.getElementById('addTask').addEventListener('click', () => this.handleAddTask());
    this.shadowRoot.getElementById('exportCsv').addEventListener('click', () => this.handleExportCsv());
    this.shadowRoot.getElementById('importButton').addEventListener('click', () =>
      this.shadowRoot.getElementById('importCsv').click()
    );
    this.shadowRoot.getElementById('importCsv').addEventListener('change', (e) => this.handleImportCsv(e));

    this.initializeDragAndDrop();
  }

  initializeDragAndDrop() {
    const board = this.shadowRoot.querySelector('.board');
    board.addEventListener('dragover', (e) => e.preventDefault());
    board.addEventListener('drop', (e) => this.handleDrop(e));
  }

  handleAddProblem() {
    const problemInput = this.shadowRoot.getElementById('problem');
    const expectedResultInput = this.shadowRoot.getElementById('expectedResult');
    const problem = problemInput.value.trim();
    const expectedResult = expectedResultInput.value.trim();

    if (!problem || !expectedResult) {
      this.showError('Por favor, preencha todos os campos.');
      return;
    }

    this.problems.push({ problem, expectedResult });
    this.updateDropdown();
    this.clearInputs([problemInput, expectedResultInput]);
  }

  handleAddTask() {
    const taskInput = this.shadowRoot.getElementById('taskInput');
    const dropdown = this.shadowRoot.getElementById('situationDropdown');
    const taskContent = taskInput.value.trim();
    const selectedProblem = dropdown.value;

    if (!taskContent || !selectedProblem) {
      this.showError('Por favor, preencha a tarefa e selecione uma Situação/Problema.');
      return;
    }

    const taskId = Date.now().toString();
    const newTask = this.createTaskElement(taskContent, taskId, selectedProblem);
    const todoColumn = this.shadowRoot.querySelector('[data-column="To Do"] .kanban-items');
    todoColumn.appendChild(newTask);

    this.logTaskChange(taskId, taskContent, 'To Do', selectedProblem);
    this.clearInputs([taskInput]);
  }

  createTaskElement(content, id, problem) {
    const task = document.createElement('div');
    Object.assign(task, {
      className: 'task',
      draggable: true,
      textContent: content
    });
    task.dataset.id = id;
    task.dataset.problem = problem;

    task.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', id);
      task.classList.add('dragging');
    });

    task.addEventListener('dragend', () => {
      task.classList.remove('dragging');
    });

    return task;
  }

  handleDrop(e) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = this.shadowRoot.querySelector(`.task[data-id="${taskId}"]`);
    const targetColumn = e.target.closest('.column');

    if (!task || !targetColumn) return;

    const newColumn = targetColumn.dataset.column;
    const oldColumn = task.parentElement.closest('.column').dataset.column;

    if (newColumn !== oldColumn) {
      const targetContainer = targetColumn.querySelector('.kanban-items');
      targetContainer.appendChild(task);
      this.logTaskChange(taskId, task.textContent, newColumn, task.dataset.problem);
    }
  }

  handleExportCsv() {
    const history = this.getTaskHistory();
    const csvContent = this.convertToCSV(history);
    this.downloadCSV(csvContent, 'kanban_tasks.csv');
  }

  async handleImportCsv(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const csvData = await this.readFileContent(file);
      this.parseAndImportCSV(csvData);
    } catch (error) {
      this.showError('Erro ao importar arquivo CSV.');
      console.error('Import error:', error);
    }
  }

  updateDropdown() {
    const dropdown = this.shadowRoot.getElementById('situationDropdown');
    dropdown.innerHTML = '<option value="" disabled selected>Selecione uma Situação/Problema</option>';
    this.problems.forEach(({ problem }) => {
      const option = document.createElement('option');
      option.value = problem;
      option.textContent = problem;
      dropdown.appendChild(option);
    });
  }

  logTaskChange(id, content, column, problem) {
    const associatedProblem = this.problems.find(p => p.problem === problem);
    const result = associatedProblem?.expectedResult || '';
    const history = this.getTaskHistory();

    history.push({
      id,
      content,
      column,
      problem,
      result,
      timestamp: this.formatDateTime(new Date())
    });

    localStorage.setItem('taskHistory', JSON.stringify(history));
  }

  formatDateTime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  convertToCSV(data) {
    const headers = ['ID', 'Problem', 'Task', 'Result', 'Timestamp', 'Column'];
    const rows = data.map(item =>
      [item.id, item.problem, item.content, item.result, item.timestamp, item.column]
    );
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  parseAndImportCSV(csvData) {
    const rows = csvData.split('\n').slice(1);
    const history = [];
    this.problems = [];

    rows.forEach(row => {
      const [id, problem, content, result, timestamp, column] = row.split(',');
      if (id && content && column) {
        history.push({ id, problem, content, result, timestamp, column });

        if (problem && !this.problems.find(p => p.problem === problem)) {
          this.problems.push({ problem, expectedResult: result || '' });
        }
      }
    });

    localStorage.setItem('taskHistory', JSON.stringify(history));
    this.updateDropdown();
    this.reloadTasks();
  }

  reloadTasks() {
    const history = this.getTaskHistory();
    const latestTasks = this.getLatestTaskStates(history);
    this.clearAllColumns();
    this.renderTasks(latestTasks);
  }

  getLatestTaskStates(history) {
    return history.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {});
  }

  clearAllColumns() {
    this.shadowRoot.querySelectorAll('.kanban-items').forEach(col => col.innerHTML = '');
  }

  renderTasks(tasks) {
    Object.values(tasks).forEach(({ id, content, column, problem }) => {
      const columnElement = this.shadowRoot.querySelector(`[data-column="${column}"] .kanban-items`);
      if (columnElement) {
        const task = this.createTaskElement(content, id, problem);
        columnElement.appendChild(task);
      }
    });
  }

  getTaskHistory() {
    return JSON.parse(localStorage.getItem('taskHistory')) || [];
  }

  clearInputs(inputs) {
    inputs.forEach(input => input.value = '');
  }

  showError(message) {
    alert(message);
  }

  loadInitialState() {
    this.reloadTasks();
    this.updateDropdown();
  }
}

customElements.define('kanban-board', KanbanBoard);