const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
const fs = require('fs');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});


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

app.command('/list-locations', async ({ command, ack, respond }) => {
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

app.command('/add-location', async ({ command, ack, respond }) => {
  await ack();

  // Разбиваем текст команды на аргументы
  const [account, locationName, ...timezoneParts] = command.text.split(' ');
  const timezone = timezoneParts.join(' ');
  const name = locationName.replace(/\P{L}/gu, '');

  // Проверка валидности часового пояса
  if (!moment.tz.zone(timezone)) {
    await respond(`Введен невалидный часовой пояс: ${timezone}. Попробуйте еще раз.`);
    return;
  }

  try {
    const locationsPath = `./locations/${account}.json`;
    let locations = {};

    // Если файл существует, загружаем его содержимое
    if (fs.existsSync(locationsPath)) {
      locations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
    }

    // Добавляем новую локацию
    locations[name] = timezone;

    // Сохраняем обновленный файл
    fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2));

    await respond(`Локация "${name}" с часовым поясом "${timezone}" успешно добавлена в "${account}".`);
  } catch (error) {
    console.error(error);
    await respond("Произошла ошибка при добавлении локации. Пожалуйста, попробуйте еще раз.");
  }
});

app.command('/delete-location', async ({ command, ack, respond }) => {
  await ack();

  // Разбиваем текст команды на аргументы для получения account и name
  const [account, locationName] = command.text.split(' ').map(arg => arg.trim());

  try {
    const locationsPath = `./locations/${account}.json`;

    // Проверяем, существует ли файл
    if (!fs.existsSync(locationsPath)) {
      await respond(`Аккаунт "${account}" не найден.`);
      return;
    }

    const locations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));

    const name = locationName.replace(/\P{L}/gu, '');

    // Проверяем, существует ли локация
    if (!locations[name]) {
      await respond(`Локация "${name}" не найдена в "${account}".`);
      return;
    }

    // Удаляем локацию и сохраняем обновленный файл
    delete locations[name];
    fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2));

    await respond(`Локация "${name}" успешно удалена из "${account}".`);
  } catch (error) {
    console.error(error);
    await respond("Произошла ошибка при удалении локации. Пожалуйста, попробуйте еще раз.");
  }
});




(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack app is running!');
})();
