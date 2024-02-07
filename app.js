const { App } = require('@slack/bolt');
const moment = require('moment-timezone');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const locations = {
  "Минск": "Europe/Minsk",
  "Варшава": "Europe/Warsaw",
  "Грузия": "Asia/Tbilisi",
  "Калифорния": "America/Los_Angeles",
  "Вирджиния": "America/New_York"
};

app.command('/time', async ({ command, ack, client, respond }) => {
  await ack();

  const timeText = command.text;
  const userId = command.user_id;
  const channel_id = command.channel_id;
  const userName = command.user_name;

  try {
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

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack app is running!');
})();
