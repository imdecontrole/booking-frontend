const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// === URL API через туннель ===
const API_URL = 'https://imdecontrole-booking-backend-98a1.twc1.net/api';

const currentUser = {
  id: tg.initDataUnsafe?.user?.id || 999,
  name: tg.initDataUnsafe?.user 
    ? `${tg.initDataUnsafe.user.first_name || ''} ${tg.initDataUnsafe.user.last_name || ''}`.trim() || 'Пользователь'
    : 'Пользователь'
};

const rooms = [
  { id: 1, name: "Производство ПСК" },
  { id: 2, name: "Офис СПБ" }
];

let bookings = [];
let selectedRoom = null;
let editingBookingId = null;

const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');

// === Универсальная функция для API запросов ===
async function apiCall(url, options = {}) {
  const initData = tg.initData || '';
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-initdata': initData,
      ...options.headers
    }
  };

  // Преобразуем body в JSON если это объект
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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
    tg.showAlert('Не удалось загрузить брони. Проверьте интернет.');
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
    const roomId = card.dataset.room === 'psk' ? 1 : 2;
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
    return tg.showAlert("Заполните все поля");
  }
  if (start >= end) {
    return tg.showAlert("Время окончания должно быть позже начала");
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

    tg.showPopup({
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
    tg.showAlert('Ошибка при бронировании: ' + (err.message || 'Нет связи с сервером'));
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

// === Мои брони с редактированием и удалением ===
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
            <button class="btn-secondary" onclick="editBooking(${b.id})" style="flex:1; padding:11px; font-size:14px;">Изменить</button>
            <button class="btn-secondary" onclick="deleteBooking(${b.id})" style="flex:1; padding:11px; font-size:14px; background:#ffe5e5; color:#c00;">Удалить</button>
          </div>
        </div>
      `;
    }).join('');

    // Глобальные функции для кнопок
    window.editBooking = async (id) => {
      const booking = my.find(b => b.id === id);
      if (!booking) return;

      selectedRoom = rooms.find(r => r.id === booking.roomId);
      editingBookingId = id;

      document.getElementById('modal-title').textContent = selectedRoom.name + " (редактирование)";
      document.getElementById('book-date').value = booking.date;
      document.getElementById('book-start').value = booking.timeStart;
      document.getElementById('book-end').value = booking.timeEnd;
      document.getElementById('manager-surname').value = booking.managerSurname;

      document.getElementById('booking-modal').classList.add('active');
    };

    window.deleteBooking = async (id) => {
      tg.showPopup({
        title: "Удалить бронь?",
        message: "Это действие нельзя отменить",
        buttons: [{ type: 'destructive', text: 'Удалить' }, { type: 'cancel' }]
      }, async (btn) => {
        if (btn !== 'destructive') return;

        try {
          await apiCall(`${API_URL}/bookings/${id}`, { method: 'DELETE' });
          tg.showAlert("Бронь удалена");
          await loadBookings();
          renderCalendar();
          loadMyBookings();
        } catch {
          tg.showAlert("Ошибка при удалении");
        }
      });
    };

  } catch (err) {
    console.error('Ошибка загрузки моих броней:', err);
    document.getElementById('my-bookings-list').innerHTML = '<div class="empty">Ошибка загрузки</div>';
  }
}

// === Инициализация ===
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Mini App initialized for user:', currentUser.name);
  
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
