const TELEGRAM_BOT_TOKEN = '8472754597:AAHCkQVxbosnVu6RM0U4HyL63DWlurjEziY';
const TELEGRAM_CHAT_ID = '-4879308527';

// Language translations
const translations = {
    uk: {
        title: 'Власник автомобіля',
        subtitle: 'Якщо моє авто заважає, будь ласка, зв\'яжіться зі мною. Я швидко переставлю машину!',
        phone: 'Подзвонити',
        notification: 'Відправити сповіщення',
        notificationTitle: 'Оберіть сповіщення',
        choosePhoto: 'Обрати фото',
        photoUploadTitle: 'Прикріпити фото (необов\'язково)',
        blocked: 'Заважає проїзду',
        accident: 'ДТП',
        alarm: 'Звучить сигналізація',
        light: 'Горить світло',
        window: 'Відкрите вікно',
        evacuation: 'Евакуація',
        flatTire: 'Спущене колесо',
        other: 'Інше',
        messageTitle: 'Залишити повідомлення',
        messagePlaceholder: 'Напишіть ваше повідомлення...',
        namePlaceholder: 'Ваше ім\'я (необов\'язково)',
        send: 'Відправити',
        footer: 'Скануйте QR-код для швидкого доступу',
        sending: 'Відправляємо...',
        successMessage: 'Повідомлення відправлено успішно! 🎉',
        errorMessage: 'Помилка відправки. Спробуйте пізніше або зателефонуйте',
        emptyMessage: 'Будь ласка, введіть повідомлення',
        sendingNotification: 'Відправка сповіщення...'
    },
    en: {
        title: 'Car Owner',
        subtitle: 'If my car is blocking you, please contact me. I\'ll move it quickly!',
        phone: 'Call',
        notification: 'Send notification',
        notificationTitle: 'Select notification',
        choosePhoto: 'Choose photo',
        photoUploadTitle: 'Attach photo (optional)',
        blocked: 'Blocking the way',
        accident: 'Accident',
        alarm: 'Alarm is sounding',
        light: 'Lights are on',
        window: 'Window is open',
        evacuation: 'Evacuation',
        flatTire: 'Flat tire',
        other: 'Other',
        messageTitle: 'Leave a Message',
        messagePlaceholder: 'Write your message...',
        namePlaceholder: 'Your name (optional)',
        send: 'Send',
        footer: 'Scan QR code for quick access',
        sending: 'Sending...',
        successMessage: 'Message sent successfully! 🎉',
        errorMessage: 'Sending error. Please try later or call',
        emptyMessage: 'Please enter a message',
        sendingNotification: 'Sending notification...'
    }
};

let currentLanguage = 'uk';
let visitorData = {};

// Function to switch language
function switchLanguage(lang) {
    currentLanguage = lang;
    
    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.lang === lang) {
            btn.classList.add('active');
        }
    });

    // Update all elements with translations
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.dataset.translatePlaceholder;
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    // Save selected language
    localStorage.setItem('selectedLanguage', lang);
}

// Language initialization
function initLanguage() {
    const savedLang = localStorage.getItem('selectedLanguage') || 'uk';
    switchLanguage(savedLang);
}

// Function to change avatar
function changeAvatar(imageUrl) {
    const avatar = document.getElementById('carAvatar');
    avatar.src = imageUrl;
    avatar.onerror = function() {
        // If image fails to load, show a placeholder
        this.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'car-icon-placeholder';
        placeholder.textContent = '🚗';
        this.parentElement.appendChild(placeholder);
    };
}

// Function to show status messages
function showStatus(message, type) {
    // Remove previous statuses
    document.querySelectorAll('.status-message').forEach(el => el.remove());
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message status-${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    const form = document.getElementById('messageForm');
    form.insertBefore(statusDiv, form.firstChild);
    
    // Automatically hide after 5 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Function to create a ripple effect
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

// Initialize event listeners
function initEventListeners() {
    // Handlers for the language switcher
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchLanguage(btn.dataset.lang);
        });
    });

    // Ripple effect for contact buttons
    document.querySelectorAll('.contact-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            createRippleEffect(this, e);
        });
    });

    // Handle form submission
    document.getElementById('messageForm').addEventListener('submit', handleFormSubmit);

    // --- New code for notifications ---
    const modal = document.getElementById('notificationModal');
    const openBtn = document.getElementById('openNotificationModal');
    const closeBtn = document.querySelector('.modal .close-btn');

    openBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Handle option selection and submission
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            // Remove 'selected' from all buttons and add to the clicked one
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');

            const messageType = this.dataset.type;
            const notificationMessage = translations[currentLanguage][messageType];
            const photoFile = document.getElementById('photoInput').files[0];
            
            showStatus(translations[currentLanguage].sendingNotification, 'success');
            
            if (photoFile) {
                await sendTelegramPhoto(notificationMessage, photoFile);
            } else {
                await sendTelegramMessage(`🚗 ${translations[currentLanguage].notification}:\n\n` + `❗️ ${notificationMessage}`);
            }

            modal.style.display = 'none';
            document.getElementById('photoInput').value = ''; // Reset file input
        });
    });
}

// Handle form submission
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
    
    // Disable the button during sending
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
        console.error('Error:', error);
        showStatus(translations[currentLanguage].errorMessage, 'error');
    } finally {
        // Re-enable the button
        sendBtn.disabled = false;
        sendBtnText.textContent = translations[currentLanguage].send;
    }
}

// Create message for Telegram
function createTelegramMessage(messageText, senderName) {
    const langPrefix = currentLanguage === 'uk' ? 'Повідомлення з сайту автомобіля' : 'Message from car website';
    const fromText = currentLanguage === 'uk' ? 'Від' : 'From';
    const dateLocale = currentLanguage === 'uk' ? 'uk-UA' : 'en-US';
    
    return `🚗 ${langPrefix}:\n\n` +
           `💬 ${messageText}\n\n` +
           `${senderName ? `👤 ${fromText}: ${senderName}\n` : ''}` +
           `🕐 ${new Date().toLocaleString(dateLocale)}`;
}

// Send message to Telegram
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

// Function to send a photo with a caption to Telegram
async function sendTelegramPhoto(caption, photoFile) {
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', `🚗 ${translations[currentLanguage].notification}:\n\n` + `❗️ ${caption}`);
    formData.append('photo', photoFile);

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showStatus(translations[currentLanguage].successMessage, 'success');
        } else {
            showStatus(translations[currentLanguage].errorMessage, 'error');
        }
        return response.ok;
    } catch (error) {
        console.error('Telegram API Error:', error);
        showStatus(translations[currentLanguage].errorMessage, 'error');
        return false;
    }
}

// Get visitor's IP and location
async function getVisitorData() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) {
            throw new Error('Failed to fetch IP and location');
        }
        const data = await response.json();
        visitorData.ip = data.ip;
        visitorData.country = data.country_name;
        visitorData.city = data.city;
    } catch (error) {
        console.error('Error fetching visitor data:', error);
        visitorData = {
            ip: 'Невідомо',
            country: 'Невідомо',
            city: 'Невідомо'
        };
    }
}

// Send a notification to Telegram when the page loads
async function sendPageLoadNotification() {
    await getVisitorData();
    
    const userAgent = navigator.userAgent;
    const browserInfo = getBrowserInfo(userAgent);
    
    const message = 
`🔔 Сторінку відкрито!
<pre>
🌐 Браузер: ${browserInfo}
🌐 IP: ${visitorData.ip}
🌍 Локація: ${visitorData.city}, ${visitorData.country}
</pre>
🕐 Час: ${new Date().toLocaleString('uk-UA')}`;
    
    await sendTelegramMessage(message);
}

// Helper function to get simplified browser info
function getBrowserInfo(userAgent) {
    const ua = userAgent.toLowerCase();
    let browser = 'Unknown';
    if (ua.includes('firefox')) {
        browser = 'Firefox';
    } else if (ua.includes('samsungbrowser')) {
        browser = 'Samsung Internet';
    } else if (ua.includes('edg')) {
        browser = 'Edge';
    } else if (ua.includes('chrome')) {
        browser = 'Chrome';
    } else if (ua.includes('safari')) {
        browser = 'Safari';
    }
    return browser;
}

// Initialization on page load
window.addEventListener('load', () => {
    initLanguage();
    initEventListeners();
    sendPageLoadNotification();
    
    console.log('🚗 Car owner contact website loaded successfully!');
    
    // INSTRUCTION: To change the avatar, uncomment and replace the URL below
    // changeAvatar('https://your-domain.com/your-avatar.png');
});