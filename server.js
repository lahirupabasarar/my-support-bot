// server.js - Bot Factory Main Code

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

// --- 1. Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const MONGO_URI = process.env.MONGO_URI;

if (!BOT_TOKEN || !ADMIN_ID || !MONGO_URI) {
    console.error("දෝෂය: BOT_TOKEN, ADMIN_ID, හෝ MONGO_URI .env ගොනුවේ අතුරුදහන් වී ඇත.");
    process.exit(1); 
}

const ADMIN_ID_NUM = parseInt(ADMIN_ID, 10);
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json()); 

// --- 2. Database Schema and Model ---
const clientBotSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    adminId: { type: String, required: true },
    creatorId: { type: String, required: true }, // Bot එක හැදූ පරිශීලකයා
    status: { type: String, default: 'active' }
});

const ClientBot = mongoose.model('ClientBot', clientBotSchema);


// --- 3. Database Connection ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB සාර්ථකව සම්බන්ධ කරන ලදී.'))
    .catch(err => console.error('❌ MongoDB සම්බන්ධ වීමේ දෝෂය:', err));


// --- 4. Main Factory Bot Logic ---
const factoryBot = new Telegraf(BOT_TOKEN);

// /newbot විධානය
factoryBot.command('newbot', async (ctx) => {
    ctx.reply(
        '🤖 **නව Bot එකක් නිර්මාණය කිරීම ආරම්භ කිරීම!**\n\n' +
        'කරුණාකර ඔබගේ **@BotFather Token එක** අපට යවන්න. ' +
        '(උදා: 7123456789:AAGkS...)\n\n' +
        '⚠️ මෙය Bot එකේ Admin ID එක ලෙස සකස් කරනු ඇත: ' + ctx.from.id,
        {
            reply_markup: {
                force_reply: true
            }
        }
    );
});

// Bot Token එක ලැබුණු විට හසුරුවන කොටස (මෙය සරල උදාහරණයකි)
factoryBot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    // සරල Token තහවුරු කිරීම (සත්‍ය Token Format එක පරීක්ෂා කිරීම අවශ්‍යයි)
    if (text.length > 30 && text.includes(':')) {
        
        try {
            // Token එක නිවැරදිදැයි පරීක්ෂා කිරීම සඳහා Telegram API එකට පණිවිඩයක් යැවීම
            const tempBot = new Telegraf(text);
            const botInfo = await tempBot.telegram.getMe();
            
            // Bot එක Database එකට Save කිරීම
            await ClientBot.create({
                token: text,
                adminId: userId, // Creator ගේ ID එකම Admin ID ලෙස සකසයි.
                creatorId: userId
            });

            // නව Client Bot එක සඳහා Webhook සකස් කිරීම
            const webhookUrl = `${process.env.PUBLIC_URL}/webhook/${text}`;
            await tempBot.telegram.setWebhook(webhookUrl);

            ctx.reply(`🎉 **සාර්ථකයි!** ඔබගේ Bot (@${botInfo.username}) සාර්ථකව ලියාපදිංචි කර සක්‍රීය කරන ලදී!\n\n` +
                      `දැන් ඔබගේ Bot එකේ ඇති ඕනෑම පණිවිඩයකට එහි Admin ලෙස ඔබටම පිළිතුරු දිය හැකිය.`);
            
        } catch (error) {
            console.error('Bot Registration Error:', error);
            ctx.reply('❌ දෝෂය: ඔබ දුන් Token එක වලංගු නැත, නැතහොත් එම Bot එක දැනටමත් ලියාපදිංචි කර ඇත.');
        }

    } else {
        // වෙනත් පණිවිඩ හසුරුවයි
        ctx.reply('කරුණාකර /newbot විධානය භාවිතා කර අනුගමනය කරන්න.');
    }
});


// --- 5. Client Bot Webhook Handling ---
// මෙම කොටස සියලුම Client Bots වලින් එන පණිවිඩ හසුරුවයි
app.post('/webhook/:token', async (req, res) => {
    const token = req.params.token;
    
    // Database එකෙන් Bot Token එකට අදාළ දත්ත සොයා ගැනීම
    const clientBotData = await ClientBot.findOne({ token });

    if (!clientBotData) {
        return res.status(404).send('Bot Not Found');
    }

    const clientBot = new Telegraf(token);
    const adminIdNum = parseInt(clientBotData.adminId, 10);
    const update = req.body;

    // Telegram වෙතින් පණිවිඩයක් ලැබී ඇත්දැයි පරීක්ෂා කිරීම
    if (update.message) {
        const message = update.message;

        // Admin විසින් Reply කරන්නේ නම් (Support Reply)
        if (message.from.id === adminIdNum && message.reply_to_message) {
            // (මෙහි පෙර තිබූ Support Reply Logic එක ඇතුළත් කළ යුතුය)
            // (කේතය විශාල වන නිසා අපි මෙය පසුව එකතු කරමු.)
            
            // දැනට සරල පිළිතුරක් යවමු
            clientBot.telegram.sendMessage(adminIdNum, 'ඔබගේ පිළිතුර ලැබුණි!');
        
        } else if (message.from.id !== adminIdNum) {
            // පරිශීලකයෙකුගෙන් Support Request එකක්
            
            try {
                // පරිශීලක පණිවිඩය Admin වෙත යොමු කිරීම
                const forwardMessage = await clientBot.telegram.forwardMessage(adminIdNum, message.chat.id, message.message_id);

                const infoMessage = `
**[Support Request]** - Bot: @${(await clientBot.telegram.getMe()).username}
👤 User ID: ${message.from.id}
✉️ Chat ID: ${message.chat.id}
🔗 Forwarded Message ID: ${forwardMessage.message_id}
                
_පිළිතුරු දීමට, **මෙම** පණිවිඩයටම **Reply** කර පිළිතුර යවන්න._
                `;
                
                await clientBot.telegram.sendMessage(adminIdNum, infoMessage, {
                    reply_to_message_id: forwardMessage.message_id 
                });
        
                await clientBot.telegram.sendMessage(message.chat.id, '✅ ඔබගේ පණිවිඩය පරිපාලකවරයා වෙත යොමු කරන ලදී.', {
                     reply_to_message_id: message.message_id
                });
        
            } catch (error) {
                console.error(`Client Bot Error for ${token}:`, error);
                clientBot.telegram.sendMessage(message.chat.id, '❌ පණිවිඩය යොමු කිරීමේදී ගැටලුවක් ඇති විය.');
            }
        }
    }

    res.status(200).send('OK');
});


// --- 6. Server Launch ---

// ප්‍රධාන Bot එක සඳහා Webhook සකස් කිරීම
factoryBot.telegram.setWebhook(`${process.env.PUBLIC_URL}/factory_webhook`);
app.post('/factory_webhook', (req, res) => factoryBot.handleUpdate(req.body, res));


// Health Check Endpoint (Railway සඳහා)
app.get('/', (req, res) => {
    res.send('Bot Factory Server is Running!');
});

// Server එක ආරම්භ කිරීම
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
});