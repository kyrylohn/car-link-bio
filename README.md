# 🚗 Contact Car Owner

A simple, user-friendly webpage designed to be displayed on a car's dashboard or windshield as a QR code. It allows other drivers to quickly contact the car owner via Telegram or a phone call, or to leave a message.

## ✨ Features

- **Multi-language Support:** The page is available in both Ukrainian (🇺🇦) and English (🇺🇸), with the ability to switch between them.
- **Direct Contact:** Provides a direct link to a phone call and a Telegram profile.
- **Message Form:** Allows others to send a text message directly to a specified Telegram chat without needing to know the car owner's phone number.
- **Responsive Design:** Looks great on both desktop and mobile devices.
- **Ripple Effects:** Interactive buttons with a smooth ripple effect for a modern user experience.

## 🛠️ How to Use

### 1. Set Up Telegram Bot

To use the message sending feature, you'll need to create a Telegram bot and get a chat ID.

1.  **Create a Bot:** Talk to the **BotFather** on Telegram and follow the instructions to create a new bot. You'll receive a `TELEGRAM_BOT_TOKEN`.
2.  **Get Your Chat ID:** Send a message to your new bot. Then, go to `https://api.telegram.org/bot[YOUR_BOT_TOKEN]/getUpdates` in your browser. Look for the `"chat"` object and find the `"id"` value. This is your `TELEGRAM_CHAT_ID`. Note: If you want to send messages to a group, the ID will be a negative number.

### 2. Configure the Code

Open the `script.js` file and replace the placeholder values with your own:

```javascript
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN'; // Replace with your bot's token
const TELEGRAM_CHAT_ID = 'YOUR_CHAT_ID'; // Replace with your chat ID
````

You can also customize the contact links in the `index.html` file:

```html
<a href="tel:+380672923375" class="contact-btn phone-btn">
    ...
</a>

<a href="[https://t.me/kyrylo_hn](https://t.me/kyrylo_hn)" class="contact-btn telegram-btn" target="_blank">
    ...
</a>
```

### 3\. Change Car Avatar (Optional)

To change the car image, simply replace the `IMG_20250909.jpg` file in the `img` folder with your own image, or uncomment the `changeAvatar` function in `script.js` and provide a new URL:

```javascript
// Uncomment and use this function to change the avatar dynamically
// changeAvatar('[https://your-domain.com/your-avatar.png](https://your-domain.com/your-avatar.png)');
```

## 🚀 Deployment

1.  **Upload Files:** Place all the project files (`index.html`, `style.css`, `script.js`, and the `img` folder) on a web server.
2.  **Generate a QR Code:** Use an online QR code generator to create a QR code that links to your deployed webpage's URL (e.g., `https://your-domain.com/index.html`).
3.  **Print and Display:** Print the QR code and place it on your car's windshield or dashboard for easy access.

Now, anyone can simply scan the code and get in touch with you\!

## 📜 License

This project is licensed under the MIT License.

```
```