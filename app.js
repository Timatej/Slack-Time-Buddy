const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
const fs = require('fs');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const locations = JSON.parse(fs.readFileSync('locations/default.json', 'utf8'));


app.command('/time', async ({ command, ack, client, respond }) => {
  await ack();

  const args = command.text.split(' ');
  const timeText = args[0];
  let fileName = args[1] ? args[1] : 'default';
  const userId = command.user_id;
  const channel_id = command.channel_id;
  const userName = command.user_name;

  try {

    let locationsPath = `./locations/${fileName}.json`;

    // Проверяем, существует ли файл. Если нет, используем default.json
    if (!fs.existsSync(locationsPath)) {
      console.log(`Файл ${fileName}.json не найден. Используется default.json.`);
      locationsPath = `./locations/${fileName}.json`;
      
      // Копирование default.json как новый файл, если было указано имя и оно не default
      if (args[1] && args[1].toLowerCase() !== 'default') {
        const defaultPath = `./locations/default.json`;
        fs.copyFileSync(defaultPath, locationsPath);
        console.log(`Создана копия файла локаций: ${locationsPath}`);
      }
    }

    const locations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));

    const result = await app.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: userId
    });

    if (result.user && result.user.tz) {
      const userTimezone = result.user.tz;
      const userTime = moment.tz(timeText, "HH:mm", userTimezone);
      let responseText = userName + ' назвал время:\n';

      for (const [location, timezone] of Object.entries(locations)) {
        const localTime = userTime.clone().tz(timezone).format("HH:mm");
        responseText += `*${location}*: ${localTime}\n`;
      }

      //await respond(responseText);
      await client.chat.postMessage({
        channel: channel_id,
        text: responseText
      });
    } else {
      await respond("Не удалось определить часовой пояс пользователя.");
    }
  } catch (error) {
    console.error(error);
    await respond("Произошла ошибка при обработке вашего запроса.");
  }
});

app.command('/list', async ({ command, ack, respond }) => {
  await ack();

  const account = command.text.trim(); // Получаем параметр account из текста команды

  try {
    const locationsPath = `./locations/${account}.json`;

    if (fs.existsSync(locationsPath)) {
      const locations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
      let responseText = "*Список локаций:*\n";
      for (const [location, timezone] of Object.entries(locations)) {
        responseText += `• *${location}* - ${timezone}\n`;
      }

      // Отправка списка локаций непосредственно пользователю через respond с markdown-форматированием
      await respond({
        text: responseText,
        mrkdwn: true
      });
    } else {
      await respond("Файл локаций не найден.");
    }
  } catch (error) {
    console.error(error);
    await respond("Произошла ошибка при обработке вашего запроса.");
  }
});


(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack app is running!');
})();
