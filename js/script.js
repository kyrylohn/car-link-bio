const TELEGRAM_BOT_TOKEN = '8472754597:AAHCkQVxbosnVu6RM0U4HyL63DWlurjEziY';
const TELEGRAM_CHAT_ID = '8472754597';

// Мовні переклади
const translations = {
    uk: {
        title: 'Власник автомобіля',
        subtitle: 'Якщо моє авто заважає, будь ласка, зв\'яжіться зі мною. Я швидко переставлю машину!',
        phone: 'Подзвонити',
        messageTitle: 'Залишити повідомлення',
        messagePlaceholder: 'Напишіть ваше повідомлення...',
        namePlaceholder: 'Ваше ім\'я (необов\'язково)',
        send: 'Відправити',
        footer: 'Скануйте QR-код для швидкого доступу',
        sending: 'Відправляємо...',
        successMessage: 'Повідомлення відправлено успішно! 🎉',
        errorMessage: 'Помилка відправки. Спробуйте пізніше або зателефонуйте',
        emptyMessage: 'Будь ласка, введіть повідомлення'
    },
    en: {
        title: 'Car Owner',
        subtitle: 'If my car is blocking you, please contact me. I\'ll move it quickly!',
        phone: 'Call',
        messageTitle: 'Leave a Message',
        messagePlaceholder: 'Write your message...',
        namePlaceholder: 'Your name (optional)',
        send: 'Send',
        footer: 'Scan QR code for quick access',
        sending: 'Sending...',
        successMessage: 'Message sent successfully! 🎉',
        errorMessage: 'Sending error. Please try later or call',
        emptyMessage: 'Please enter a message'
    }
};

let currentLanguage = 'uk';

// Функція перемикання мови
function switchLanguage(lang) {
    currentLanguage = lang;
    
    // Оновлюємо активну кнопку
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.lang === lang) {
            btn.classList.add('active');
        }
    });

    // Оновлюємо всі елементи з перекладами
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    // Оновлюємо placeholder'и
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.dataset.translatePlaceholder;
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    // Зберігаємо вибрану мову
    localStorage.setItem('selectedLanguage', lang);
}

// Ініціалізація мови
function initLanguage() {
    const savedLang = localStorage.getItem('selectedLanguage') || 'uk';
    switchLanguage(savedLang);
}

// Функція зміни аватара
function changeAvatar(imageUrl) {
    const avatar = document.getElementById('carAvatar');
    avatar.src = imageUrl;
    avatar.onerror = function() {
        // Якщо зображення не завантажилось, показуємо placeholder
        this.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'car-icon-placeholder';
        placeholder.textContent = '🚗';
        this.parentElement.appendChild(placeholder);
    };
}

// Функція показу статусних повідомлень
function showStatus(message, type) {
    // Видаляємо попередні статуси
    document.querySelectorAll('.status-message').forEach(el => el.remove());
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message status-${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    const form = document.getElementById('messageForm');
    form.insertBefore(statusDiv, form.firstChild);
    
    // Автоматично приховуємо через 5 секунд
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Функція створення ripple ефекту
function createRippleEffect(element, event) {
    const ripple = document.createElement('div');
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.3);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    `;
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size/2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size/2) + 'px';
    
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

// Ініціалізація обробників подій
function initEventListeners() {
    // Обробники для перемикача мови
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchLanguage(btn.dataset.lang);
        });
    });

    // Ripple ефект для кнопок контактів
    document.querySelectorAll('.contact-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            createRippleEffect(this, e);
        });
    });

    // Обробка форми повідомлення
    document.getElementById('messageForm').addEventListener('submit', handleFormSubmit);
}

// Обробка відправки форми
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const messageText = document.getElementById('messageText').value.trim();
    const senderName = document.getElementById('senderName').value.trim();
    const sendBtn = document.querySelector('.send-btn');
    const sendBtnText = sendBtn.querySelector('[data-translate="send"]');
    
    if (!messageText) {
        showStatus(translations[currentLanguage].emptyMessage, 'error');
        return;
    }
    
    // Блокуємо кнопку під час відправки
    sendBtn.disabled = true;
    sendBtnText.textContent = translations[currentLanguage].sending;
    
    try {
        const message = createTelegramMessage(messageText, senderName);
        const success = await sendTelegramMessage(message);
        
        if (success) {
            showStatus(translations[currentLanguage].successMessage, 'success');
            document.getElementById('messageForm').reset();
        } else {
            throw new Error('Sending failed');
        }
        
    } catch (error) {
        console.error('Помилка:', error);
        showStatus(translations[currentLanguage].errorMessage, 'error');
    } finally {
        // Розблокуємо кнопку
        sendBtn.disabled = false;
        sendBtnText.textContent = translations[currentLanguage].send;
    }
}

// Створення повідомлення для Telegram
function createTelegramMessage(messageText, senderName) {
    const langPrefix = currentLanguage === 'uk' ? 'Повідомлення з сайту автомобіля' : 'Message from car website';
    const fromText = currentLanguage === 'uk' ? 'Від' : 'From';
    const dateLocale = currentLanguage === 'uk' ? 'uk-UA' : 'en-US';
    
    return `🚗 ${langPrefix}:\n\n` +
           `💬 ${messageText}\n\n` +
           `${senderName ? `👤 ${fromText}: ${senderName}\n` : ''}` +
           `🕐 ${new Date().toLocaleString(dateLocale)}`;
}

// Відправка повідомлення в Telegram
async function sendTelegramMessage(message) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        return response.ok;
    } catch (error) {
        console.error('Telegram API Error:', error);
        return false;
    }
}

// Ініціалізація при завантаженні сторінки
window.addEventListener('load', () => {
    initLanguage();
    initEventListeners();
    
    console.log('🚗 Сайт контактів власника авто завантажено успішно!');
    
    // ІНСТРУКЦІЯ: Щоб змінити аватар, розкоментуйте та замініть URL нижче
    // changeAvatar('https://your-domain.com/your-avatar.png');
});