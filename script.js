const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// === URL API ===
const API_URL = 'https://imdecontrole-booking-backend-98a1.twc1.net/api';

// Обновленные комнаты с добавлением МСК
const rooms = [
  { id: 1, name: "Производство ПСК" },
  { id: 2, name: "Офис СПБ" },
  { id: 3, name: "Офис МСК" }
];

let bookings = [];
let selectedRoom = null;
let editingBookingId = null;

const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');

// === Универсальная функция для API запросов ===
async function apiCall(url, options = {}) {
  const initData = window.Telegram.WebApp.initData;
  console.log('Making API call to:', url);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-initdata': initData || '',
      ...options.headers
    }
  };

  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// === Загрузка всех броней с сервера ===
async function loadBookings() {
  try {
    bookings = await apiCall(`${API_URL}/bookings`);
    console.log('Брони загружены:', bookings.length);
  } catch (err) {
    console.error('Ошибка загрузки броней:', err);
    showAlert('Не удалось загрузить брони. Проверьте интернет.');
  }
}

// === Универсальные функции показа уведомлений ===
function showAlert(message) {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
    window.Telegram.WebApp.showAlert(message);
  } else {
    alert(message);
  }
}

function showPopup(options, callback) {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showPopup) {
    try {
      window.Telegram.WebApp.showPopup(options, callback);
    } catch (error) {
      console.warn('showPopup not supported, using alert');
      alert(options.message || options.title);
      if (callback) callback('ok');
    }
  } else {
    alert(options.message || options.title);
    if (callback) callback('ok');
  }
}

// === Навигация ===
navItems.forEach(item => {
  item.addEventListener('click', async () => {
    const screenId = item.dataset.screen;
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    if (screenId === 'calendar') {
      await loadBookings();
      renderCalendar();
    }
    if (screenId === 'mybookings') {
      await loadMyBookings();
    }
  });
});

// === Выбор комнаты ===
document.querySelectorAll('.btn-book').forEach(btn => {
  btn.addEventListener('click', e => {
    const card = e.target.closest('.room-card');
    const roomType = card.dataset.room;
    let roomId;
    
    if (roomType === 'psk') roomId = 1;
    else if (roomType === 'spb') roomId = 2;
    else if (roomType === 'msk') roomId = 3;
    
    selectedRoom = rooms.find(r => r.id === roomId);
    editingBookingId = null;

    document.getElementById('modal-title').textContent = selectedRoom.name;
    
    // Устанавливаем текущую дату
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('book-date').value = formattedDate;
    
    document.getElementById('book-start').value = '10:00';
    document.getElementById('book-end').value = '11:00';
    document.getElementById('manager-surname').value = '';
    document.getElementById('booking-modal').classList.add('active');
  });
});

// === Модалка бронирования ===
document.getElementById('cancel-booking').onclick = () => {
  document.getElementById('booking-modal').classList.remove('active');
  editingBookingId = null;
};

document.getElementById('confirm-booking').onclick = async () => {
  const date = document.getElementById('book-date').value;
  const start = document.getElementById('book-start').value;
  const end = document.getElementById('book-end').value;
  const surname = document.getElementById('manager-surname').value.trim();

  if (!date || !start || !end || !surname) {
    return showAlert("Заполните все поля");
  }
  if (start >= end) {
    return showAlert("Время окончания должно быть позже начала");
  }

  const body = {
    roomId: selectedRoom.id,
    date,
    timeStart: start,
    timeEnd: end,
    managerSurname: surname.toUpperCase()
  };

  const url = editingBookingId 
    ? `${API_URL}/bookings/${editingBookingId}`
    : `${API_URL}/bookings`;

  const method = editingBookingId ? 'PUT' : 'POST';

  try {
    const data = await apiCall(url, {
      method,
      body: body
    });

    showPopup({
      title: "Готово!",
      message: editingBookingId ? "Бронь обновлена" : `Забронировано на ${surname.toUpperCase()}`
    }, async () => {
      document.getElementById('booking-modal').classList.remove('active');
      editingBookingId = null;
      await loadBookings();
      renderCalendar();
      if (document.getElementById('mybookings').classList.contains('active')) {
        loadMyBookings();
      }
    });

  } catch (err) {
    console.error('Ошибка бронирования:', err);
    // Улучшенные сообщения об ошибках
    if (err.message.includes('уже занята')) {
      showAlert('На это время переговорка уже занята. Выберите другое время.');
    } else if (err.message.includes('прошлом')) {
      showAlert('Нельзя забронировать переговорку в прошлом. Выберите другую дату.');
    } else {
      showAlert('Ошибка при бронировании: ' + (err.message || 'Нет связи с сервером'));
    }
  }
};

// === Календарь ===
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function renderCalendar() {
  const daysContainer = document.getElementById('calendar-days');
  const monthYearEl = document.getElementById('month-year');
  monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  daysContainer.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = firstDay === 0 ? 6 : firstDay - 1;

  // Пустые ячейки для начала месяца
  for (let i = 0; i < startDay; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day other-month';
    daysContainer.appendChild(emptyDay);
  }

  // Дни месяца
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    const today = new Date();
    if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      dayEl.classList.add('today');
    }

    // Проверяем есть ли брони на этот день
    const dayBookings = bookings.filter(b => b.date === dateStr);
    if (dayBookings.length > 0) {
      dayEl.classList.add('has-booking');
      dayEl.title = `${dayBookings.length} броней`;
    }

    dayEl.addEventListener('click', () => showDayBookings(dateStr, day));
    daysContainer.appendChild(dayEl);
  }
}

document.getElementById('prev-month').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

function showDayBookings(dateStr, dayNum) {
  const dayBookings = bookings
    .filter(b => b.date === dateStr)
    .map(b => ({ ...b, room: rooms.find(r => r.id === b.roomId) }))
    .sort((a, b) => a.timeStart.localeCompare(b.timeStart));

  document.getElementById('day-modal-title').textContent = `${dayNum} ${monthNames[currentMonth].toLowerCase()}`;

  const list = document.getElementById('day-bookings-list');
  if (dayBookings.length === 0) {
    list.innerHTML = '<p style="color:#717171;padding:20px 0;text-align:center;">Нет бронирований</p>';
  } else {
    list.innerHTML = dayBookings.map(b => `
      <div class="booking-item">
        <h4>${b.room.name}</h4>
        <div class="time">${b.timeStart} – ${b.timeEnd}</div>
        <div class="user"><strong>${b.managerSurname}</strong></div>
        <div style="color: #717171; font-size: 14px; margin-top: 4px;">${b.userName}</div>
      </div>
    `).join('');
  }

  document.getElementById('day-modal').classList.add('active');
}

document.getElementById('close-day-modal').onclick = () => {
  document.getElementById('day-modal').classList.remove('active');
};

// === Мои брони с улучшенным редактированием и удалением ===
async function loadMyBookings() {
  try {
    const my = await apiCall(`${API_URL}/my-bookings`);
    
    const container = document.getElementById('my-bookings-list');
    if (my.length === 0) {
      container.innerHTML = '<div class="empty">У вас пока нет бронирований</div>';
      return;
    }

    container.innerHTML = my.map(b => {
      const room = rooms.find(r => r.id === b.roomId);
      return `
        <div class="booking-item">
          <h4>${room.name}</h4>
          <div>${b.date.replace(/-/g, '.')} • ${b.timeStart}–${b.timeEnd}</div>
          <div class="user"><strong>${b.managerSurname}</strong></div>
          <div style="margin-top:14px; display:flex; gap:10px;">
            <button class="btn-secondary edit-btn" data-id="${b.id}" style="flex:1; padding:11px; font-size:14px;">Изменить</button>
            <button class="btn-secondary delete-btn" data-id="${b.id}" style="flex:1; padding:11px; font-size:14px; background:#ffe5e5; color:#c00;">Удалить</button>
          </div>
        </div>
      `;
    }).join('');

    // Добавляем обработчики через делегирование событий
    container.addEventListener('click', async (e) => {
      if (e.target.classList.contains('edit-btn')) {
        const id = parseInt(e.target.dataset.id);
        await editBooking(id, my);
      }
      
      if (e.target.classList.contains('delete-btn')) {
        const id = parseInt(e.target.dataset.id);
        await deleteBooking(id);
      }
    });

  } catch (err) {
    console.error('Ошибка загрузки моих броней:', err);
    document.getElementById('my-bookings-list').innerHTML = '<div class="empty">Ошибка загрузки</div>';
  }
}

// Функция редактирования брони
async function editBooking(id, myBookings) {
  const booking = myBookings.find(b => b.id === id);
  if (!booking) return;

  selectedRoom = rooms.find(r => r.id === booking.roomId);
  editingBookingId = id;

  document.getElementById('modal-title').textContent = selectedRoom.name + " (редактирование)";
  document.getElementById('book-date').value = booking.date;
  document.getElementById('book-start').value = booking.timeStart;
  document.getElementById('book-end').value = booking.timeEnd;
  document.getElementById('manager-surname').value = booking.managerSurname;

  document.getElementById('booking-modal').classList.add('active');
}

// Функция удаления брони
async function deleteBooking(id) {
  showPopup({
    title: "Удалить бронь?",
    message: "Это действие нельзя отменить",
    buttons: [{ type: 'destructive', text: 'Удалить' }, { type: 'cancel', text: 'Отмена' }]
  }, async (btn) => {
    if (btn !== 'destructive') return;

    try {
      await apiCall(`${API_URL}/bookings/${id}`, { method: 'DELETE' });
      showAlert("Бронь успешно удалена");
      // Мгновенное обновление интерфейса
      await loadBookings();
      renderCalendar();
      await loadMyBookings();
    } catch (err) {
      console.error('Ошибка удаления:', err);
      showAlert("Ошибка при удалении: " + (err.message || 'Неизвестная ошибка'));
    }
  });
}

// === Инициализация ===
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Mini App initialized');
  console.log('initData available:', !!window.Telegram.WebApp.initData);
  console.log('initData length:', window.Telegram.WebApp.initData ? window.Telegram.WebApp.initData.length : 0);
  
  // Загружаем брони при старте
  await loadBookings();
  
  // Если активен календарь - рендерим его
  if (document.getElementById('calendar').classList.contains('active')) {
    renderCalendar();
  }
  
  // Если активны "Мои брони" - загружаем их
  if (document.getElementById('mybookings').classList.contains('active')) {
    await loadMyBookings();
  }
});
