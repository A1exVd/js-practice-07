'use strict';

// ============================================================
// ПРАКТИЧЕСКАЯ РАБОТА №7 — События в JS
// script_07.js — Starter Kit (заготовка для студентов)
//
// ЗАДАЧА: Реализовать интерактивную Kanban-доску.
// Читайте комментарии — они подскажут, что и где нужно написать.
// Комментарии «ПОЧЕМУ?» — обязательно заполните сами!
// ============================================================

// ============================================================
// 1. ПОИСК ЭЛЕМЕНТОВ
// WHY? Все ссылки на DOM-узлы собираем в одном месте — легко
// найти и изменить при необходимости.
// ============================================================

const taskInput       = document.querySelector('#task-input');
const prioritySelect  = document.querySelector('#priority-select');
const addTaskBtn      = document.querySelector('#add-task-btn');
const validationMsg   = document.querySelector('#validation-msg');

const toggleThemeBtn  = document.querySelector('#toggle-theme-btn');
const clearDoneBtn    = document.querySelector('#clear-done-btn');
const viewModeBtn     = document.querySelector('#view-mode-btn');
const taskCountEl     = document.querySelector('#task-count');

const board           = document.querySelector('#board');
const welcomeBanner   = document.querySelector('#welcome-banner');
const closeBannerBtn  = document.querySelector('#close-banner-btn');

const loadTasksBtn = document.querySelector('#load-tasks-btn');
const dragDropModeBtn = document.querySelector("#dragdrop-mode-btn");
// Порядок колонок — используется для перемещения задач
const COLUMN_ORDER = ['todo', 'in-progress', 'done'];

// Словарь меток приоритетов
const PRIORITY_LABELS = {
  low:    '🟢 Низкий',
  medium: '🟡 Средний',
  high:   '🔴 Высокий',
};

const PRIORITY_ORDER = { 
    high: 0,
    medium: 1,
    low: 2
};

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/** 
 * Безопасная установка текста узла.
 * Почему textContent?
 * Использую textContent для вставки текста от пользователя, так как является безопасным по сравнение с innerHTML
 * innerHTML вставляет не только текст, но и парсит html разметку,
 * что создает возможность для XSS-атак. innerHTML используется только для вставки
 * html-разметки из доверенного источника.
 */
function safeText(node, text) {
  node.textContent = text;
}

/** Генерация уникального ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Показать сообщение об ошибке валидации */
function showError(msg) {
  safeText(validationMsg, msg);
}

/** Сбросить сообщение об ошибке */
function clearError() {
  validationMsg.textContent = '';
}

/** Возвращает рандомный элемент массива */
function randomArrEl(arr) {
    const randomIdx = Math.floor(Math.random() * arr.length);
    return arr[randomIdx];
}

// ============================================================
// 3. СЧЁТЧИКИ
// ============================================================

/**
 * Обновляет общий счётчик задач и счётчики в заголовках колонок.
 * ПОЧЕМУ? querySelectorAll?
 * Используем querySelectorAll, так как возвращает статический NodeList, что позволяет
 * использовать length свойство сразу без преобразования в array.
 */
function updateCounters() {
  const allCards = document.querySelectorAll('.task-card');
  safeText(taskCountEl, String(allCards.length));

  COLUMN_ORDER.forEach(status => {
    const column     = document.querySelector(`.column[data-status="${status}"]`);
    const countBadge = column.querySelector('.column-count');
    const cards      = column.querySelectorAll('.task-card');
    safeText(countBadge, String(cards.length));
  });
}

// ============================================================
// 4. СОЗДАНИЕ КАРТОЧКИ ЗАДАЧИ
// ============================================================

/**
 * Создаёт DOM-узел карточки задачи.
 * WHY createElement? — TODO: напишите ваш комментарий здесь.
 * Использую createElement так как позволяет создать html-элемент, задать
 * необходимые свойства и безопасно добавить его в DOM-дерево с помощью append
 *
 * @param {{ id: string, text: string, priority: string }} task
 * @returns {HTMLElement}
 */
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id       = task.id;
  card.dataset.priority = task.priority;
  card.draggable = true;
  // Добавляем класс для высокого приоритета (PRO: используется для сортировки)
  if (task.priority === 'high') {
    card.classList.add('priority-high');
  }

  // Заголовок задачи
  const title = document.createElement('h3');
  safeText(title, task.text);

  // Бейдж приоритета
  const badge = document.createElement('span');
  badge.className = `priority-badge ${task.priority}`;
  safeText(badge, PRIORITY_LABELS[task.priority] || task.priority);

  // Кнопки действий
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-secondary';
  prevBtn.dataset.action = 'prev';
  safeText(prevBtn, '← Назад');

  const nextBtn = document.createElement('button');
  nextBtn.dataset.action = 'next';
  safeText(nextBtn, '→ Вперёд');

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger';
  delBtn.dataset.action = 'delete';
  safeText(delBtn, '✕ Удалить');

  actions.append(prevBtn, nextBtn, delBtn);
  card.append(title, badge, actions);

  return card;
}

// ============================================================
// 5. ДОБАВЛЕНИЕ ЗАДАЧИ
// ============================================================

/**
 * Читает форму, валидирует, создаёт карточку и добавляет в колонку «todo».
 */
function addTask() {
  const text     = (taskInput.value || '').trim();
  const priority = prioritySelect.value;

  // --- Валидация ---
  if (text.length < 3) {
    showError('Название задачи должно содержать минимум 3 символа.');
    taskInput.focus();
    return;
  }

  clearError();

  const task = {
    id:       generateId(),
    text,
    priority,
    status:   'todo',
  };

  const card    = createTaskCard(task);
  const todoList = document.querySelector('[data-status="todo"] .task-list');
  insertSorted(todoList, card);

  // Сбрасываем форму
  taskInput.value = '';
  prioritySelect.selectedIndex = 1; // сброс на «Средний»
  taskInput.focus();

  updateCounters();
  saveToStorage();
}

// ============================================================
// 6. ОБРАБОТЧИКИ ФОРМЫ
// ============================================================

// WHY addEventListener? — TODO: напишите ваш комментарий здесь.
// Использую addEventListener, так как является современным стандартом.
// Позволяет задать неограниченное количество обработчиков на одно событие.

addTaskBtn.addEventListener('click', addTask);

// Обработка клавиатуры в поле ввода
// WHY keydown? — TODO: напишите ваш комментарий здесь.
// Ипользую keydown, так как является современным стандартом. Реагирует на все клавиши.
// Позволяет обработать нажатие и при необходимости отменить его, используя preventDefault.
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTask();
  }
  if (e.key === 'Escape') {
    taskInput.value = '';
    clearError();
  }
});

// ============================================================
// 7. ДЕЛЕГИРОВАНИЕ СОБЫТИЙ НА ДОСКЕ ⭐
//
// WHY один обработчик на #board, а не на каждую кнопку?
// TODO: напишите ваш комментарий здесь.
// Ипользуем один обработчик на #board для улучшения прозводительности, 
// уменьшения затрат памяти, а также упрощения работы с динамическими элементами.
// В данном случае используем всплытие, то есть при нажатии на кнопку дочернего 
// элемента событие поднимается вверх к родительскому.
// ============================================================

/**
 * Главный обработчик кликов на доске.
 * Определяет нажатую кнопку через closest('[data-action]').
 */
function boardClickHandler(e) {
  // Ищем ближайшую кнопку с data-action
  // WHY closest? — TODO: Удобный способ быстро получить родительский элемент
  const actionBtn = e.target.closest('[data-action]');
  const card      = e.target.closest('.task-card');

  if (!card) return; // клик вне карточки — игнорируем

  if (actionBtn) {
    // WHY stopPropagation? — TODO: напишите ваш комментарий здесь.
    // Используем e.stopPropagation, чтобы предотвратить всплытие события
    // к корневому элементу DOM. То есть, если предок элемент содержащий 
    // board элемент имеет какие-то обработчики на "click", то при отсутствии 
    // stopPropagation они также будут вызваны.
    e.stopPropagation();

    const action = actionBtn.dataset.action;

    if (action === 'delete') {
      if (confirm('Удалить задачу?')) {
        card.remove(); // WHY remove()? — TODO: современный и простой способ удалить элемент из DOM
        saveToStorage();
        updateCounters();
        return;
      }
    }

    const cardColumn = card.closest('.column');
    const cardStatus = cardColumn.dataset.status;
    const statusIdx = COLUMN_ORDER.findIndex(status => status === cardStatus);

    if (action === 'next') {
      if(statusIdx < COLUMN_ORDER.length -1) {
          cardColumn.nextElementSibling.querySelector('.task-list').append(card);
          updateCounters();
      }
    }

    if (action === 'prev') {
      if(statusIdx > 0) {
        cardColumn.previousElementSibling.querySelector('.task-list').append(card);
        updateCounters();
      }
    }

    saveToStorage();
    return; // важно: выходим, чтобы не сработало выделение карточки
  }

  // Клик на саму карточку (не на кнопку) — выделение
  // WHY classList.toggle? — TODO: использую toggle вместо add/remove так как делает код лаконичнее
  // и позволяет избежать дополнительных проверок с if
  card.classList.toggle('selected');
}

// Вешаем обработчик на доску
board.addEventListener('click', boardClickHandler);


// ============================================================
// 8. УПРАВЛЕНИЕ ТЕМОЙ И ОЧИСТКА
// ============================================================

// WHY classList.toggle? — TODO: использую toggle вместо add/remove так как делает код лаконичнее
// и позволяет избежать дополнительных проверок с if
toggleThemeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

clearDoneBtn.addEventListener('click', () => {
  const doneList = document.querySelector('[data-status="done"] .task-list');
  const cards    = doneList.querySelectorAll('.task-card');

  if (!cards.length) {
    alert('Колонка «Готово» уже пуста.');
    return;
  }

  // WHY confirm? — TODO: Использую confirm для улучшения пользовательского опыта,
  // чтобы пользователь случайно не очиситил колонку при нажатии кнопки.
  // Лучше использовать кастомный confirm. 
  if (!confirm(`Удалить все ${cards.length} задач из колонки «Готово»?`)) return;

  cards.forEach(card => card.remove());
  updateCounters();
  saveToStorage();
});

// ============================================================
// 9. PRO: РЕЖИМ ПРОСМОТРА (removeEventListener)
//
// WHY removeEventListener требует именованную функцию?
// TODO: требует именованную функцию, чтобы удалить конкретный обработчик события
// так как у одного события может быть несколько обработчиков.
// ============================================================



let isViewMode = false;

viewModeBtn.addEventListener('click', () => {
  isViewMode = !isViewMode;

  if (isViewMode) {
    // TODO: отключить boardClickHandler через removeEventListener
    board.removeEventListener('click', boardClickHandler);
    viewModeBtn.classList.add('view-mode-active');
    safeText(viewModeBtn, '✏️ Режим редактирования');

    // Отключить Drag and Drop; заблокировать dragDropModeBtn
    disableDragDromMode();

  } else {
    // TODO: включить boardClickHandler обратно через addEventListener
    board.addEventListener('click', boardClickHandler);
    viewModeBtn.classList.remove('view-mode-active');
    safeText(viewModeBtn, '👁 Режим просмотра');

    // Разблокировать dragDropModeBtn 
    enableDragDropMode();
  }
});


// ============================================================
// 10. PRO: ПРИВЕТСТВЕННЫЙ БАННЕР ({ once: true })
//
// WHY { once: true }? — TODO: Используем { once: true } так как при удалени
// элемента из DOM без удаления обработчика, последний остается в памяти (утечка памяти).
// используя { once: true } браузер автоматически удаляет обработчик после выполнения единожды.
// ============================================================

// TODO: замените обычный addEventListener на вариант с { once: true }
closeBannerBtn.addEventListener('click', () => {
  welcomeBanner.remove();
  // Подсказка: используйте { once: true } как третий аргумент addEventListener
  // Тогда этот обработчик сработает ровно один раз и удалится автоматически.
}, {once: true});

// ============================================================
// 11. PRO: localStorage
//
// TODO: реализуйте функции saveToStorage() и loadFromStorage()
// ============================================================

function saveToStorage() { 
    const allCards = Array.from(document.querySelectorAll('.task-card'));

    const tasks = allCards
        .map(card => ({
            id: card.getAttribute('data-id'),
            text: card.querySelector("h3").textContent,
            priority: card.getAttribute('data-priority'),
            status: card.closest('.column').getAttribute('data-status')
            }));
    try {
        localStorage.setItem("tasks-v1", JSON.stringify(tasks))
    } catch (error) {
        console.warn('localStorage недоступен:', error);    
    }
}

function loadFromStorage(key) {
    try {
        const loadObj = localStorage.getItem(key);
        if(!loadObj) return;
        return JSON.parse(loadObj);
    } catch (error) {
        return error;
    }
}

function loadTasksToDOM(tasks) {
    if(tasks instanceof Error || !tasks) return console.log("ошибка загрузки");

    const todoFragment = document.createDocumentFragment();
    const inProgressFragment = document.createDocumentFragment();
    const doneFragment = document.createDocumentFragment();

    const todoList = document.querySelector('[data-status="todo"] .task-list');
    const inProgressList = document.querySelector('[data-status="in-progress"] .task-list');
    const doneList = document.querySelector('[data-status="done"] .task-list');

    tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

    tasks.forEach(task => {
        if(task.status === "todo") {
            todoFragment.append(createTaskCard(task));
        } else if (task.status === "in-progress") {
            inProgressFragment.append(createTaskCard(task));
        } else if (task.status === "done") {
            doneFragment.append(createTaskCard(task));
        }
    });

    todoList.append(todoFragment);
    inProgressList.append(inProgressFragment);
    doneList.append(doneFragment);
}

loadTasksBtn.addEventListener("click", () => {
    loadTasksToDOM(generateRandomTasks(100));
    saveToStorage();
    updateCounters();
});

/** Создает указанное количество задач */ 
function generateRandomTasks(totalNum) {
    const tasksArr = [];

    for (let i = 0; i < totalNum; i++) {
        tasksArr.push({
            id: generateId(),
            text: randomArrEl(["Изучить делегирование событий", "Написать README", 
                "Сделать скриншоты", "Запушить на GitHub"]),
            priority: randomArrEl(["high","medium", "low"]),
            status: "todo"
        })
    }
    
    return tasksArr;
}


/** Вставка задачи в порядке сортировки */
function insertSorted(list, card) {
  const newPrio = PRIORITY_ORDER[card.dataset.priority] ?? 99;
  const cards = [...list.querySelectorAll('.task-card')];
  const after = cards.find(c => (PRIORITY_ORDER[c.dataset.priority] ?? 99) > newPrio);
  list.insertBefore(card, after || null);
}




// ============================================================
// DRAG AND DROP Mode
// ============================================================


let isDragDropMode = false;

dragDropModeBtn.addEventListener('click', () => {
    isDragDropMode = !isDragDropMode;

    if(isDragDropMode) {
        addHandlersDragDrop();
        dragDropModeBtn.classList.add('view-mode-active');
        safeText(dragDropModeBtn, 'Режим Drag&Drop');
    } else {
        removeHandlersDragDrop();
        dragDropModeBtn.classList.remove('view-mode-active');
        safeText(dragDropModeBtn, 'Режим Drag&Drop (Отключен)');
    }
})


// Функции блокировки и разблокировки режима для режима просмотра
function disableDragDromMode() {
    isDragDropMode = false;
    removeHandlersDragDrop();
    dragDropModeBtn.classList.remove('view-mode-active');
    safeText(dragDropModeBtn, 'Режим Drag&Drop (Отключен)');
    dragDropModeBtn.disabled = true;
}

function enableDragDropMode() {
    dragDropModeBtn.disabled = false;
}
/////////////////////////////////////////////////////////


let draggableTask;

const handleDragEnd = (e) => {
    draggableTask.classList.remove("fade");
}

const handleDragStart = (e) => {
    draggableTask = e.target.closest(".task-card");

    if(!draggableTask) return 

    draggableTask.classList.add("fade");
    draggableTask.addEventListener("dragend", handleDragEnd, {once: true})
}

const handleDragOver = (e) => {
    e.preventDefault();
}

const handleDragEnter = (e) => {
    if(e.target !== e.currentTarget) return;

    if(!isValidTransition(draggableTask, e.currentTarget)) return;
    
    const taskList = e.currentTarget.querySelector(".task-list");
    taskList.classList.add("pointer-none");
    e.currentTarget.classList.add("drop-zone");
}

const handleDragLeave = (e) => {
    if(e.target !== e.currentTarget) return;

    if(!isValidTransition(draggableTask, e.currentTarget)) return;
    
    const taskList = e.currentTarget.querySelector(".task-list");
    taskList.classList.remove("pointer-none");
    e.currentTarget.classList.remove("drop-zone");

}

const handleDragDrop = (e) => {
    e.preventDefault();
    if(!isValidTransition(draggableTask, e.currentTarget)) return;

    console.log("droped")
    const taskList = e.currentTarget.querySelector(".task-list");
    taskList.append(draggableTask);
    e.currentTarget.classList.remove("drop-zone");
    taskList.classList.remove("pointer-none");
    saveToStorage();
}


function addHandlersDragDrop() {
    board.addEventListener("dragstart", handleDragStart);

    const statusArr = ["todo", "in-progress", "done"];

    statusArr.forEach(status => {
        const column = document.querySelector(`[data-status=${status}]`);
    
        column.addEventListener("dragover", handleDragOver);
    
        column.addEventListener("dragenter", handleDragEnter);
    
        column.addEventListener("dragleave", handleDragLeave);
    
        column.addEventListener("drop", handleDragDrop);
    })
}

function removeHandlersDragDrop() {
    board.removeEventListener("dragstart", handleDragStart);

    const statusArr = ["todo", "in-progress", "done"];

    statusArr.forEach(status => {
        const column = document.querySelector(`[data-status=${status}]`);
    
        column.removeEventListener("dragover", handleDragOver);
    
        column.removeEventListener("dragenter", handleDragEnter);
    
        column.removeEventListener("dragleave", handleDragLeave);
    
        column.removeEventListener("drop", handleDragDrop);
    })
}



// Возвращает true если возможен переход
function isValidTransition(task, columnToMove) {
    if(!task) return;
    const taskStatus = draggableTask.closest(".column").dataset.status;
    const taskStatusIdx = COLUMN_ORDER.findIndex(status => status === taskStatus);
    const columnStatusIdx = COLUMN_ORDER.findIndex(status => status === columnToMove.dataset.status);

    // если колонки одинаковые
    if(taskStatusIdx === columnStatusIdx) return;

    // перемещеие возможно только в соседнюю колонку
    if(Math.abs(taskStatusIdx - columnStatusIdx) === 2) return;

    return true;
}


// ============================================================
// 12. ИНИЦИАЛИЗАЦИЯ
// ============================================================


// PRO: loadFromStorage() — раскомментируйте после реализации
loadTasksToDOM(loadFromStorage("tasks-v1"));
updateCounters();



