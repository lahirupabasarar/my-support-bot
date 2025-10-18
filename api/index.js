// index.js (Vercel සඳහා වෙනස් කරන ලදි)

require('dotenv').config();
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 

if (!BOT_TOKEN || !ADMIN_ID) {
    console.error("දෝෂය: BOT_TOKEN හෝ ADMIN_ID .env ගොනුවේ සොයාගත නොහැක.");
    process.exit(1); 
}

const ADMIN_ID_NUM = parseInt(ADMIN_ID, 10); 
const bot = new Telegraf(BOT_TOKEN);

// --- බොට් ලොජික් (පෙර තිබූ ආකාරයටම) ---

// A. /start විධානය
bot.start((ctx) => {
    ctx.reply(
        '👋 ආයුබෝවන්! මම සහාය (Support) ලබා දෙන bot කෙනෙක්. ' +
        'ඔබට ඇති ඕනෑම ප්‍රශ්නයක් හෝ ගැටලුවක් මෙහි සටහන් කරන්න.'
    );

    if (ctx.from.id !== ADMIN_ID_NUM) {
         bot.telegram.sendMessage(ADMIN_ID_NUM, `නව පරිශීලකයෙක් bot එක ආරම්භ කළා: @${ctx.from.username || ctx.from.id}`);
    }
});

// B. පරිපාලකයාගේ පිළිතුර හසුරුවන කොටස
bot.on('message', async (ctx) => {
    const message = ctx.message;

    if (ctx.from.id === ADMIN_ID_NUM && message.reply_to_message) {
        
        const repliedMessage = message.reply_to_message;
        
        if (repliedMessage.text && repliedMessage.text.includes('Support Request') && repliedMessage.text.includes('Chat ID')) {
            
            // Regex භාවිතයෙන් Chat ID ලබා ගැනීම
            const chatIdMatch = repliedMessage.text.match(/Chat ID:\s*(-?\d+)/); 
            
            if (chatIdMatch && chatIdMatch[1]) {
                const targetChatId = chatIdMatch[1];
                const replyText = message.text; 

                try {
                    await bot.telegram.sendMessage(targetChatId, `📣 **පරිපාලක පිළිතුර:**\n\n${replyText}`, {
                        parse_mode: 'Markdown'
                    });
                    ctx.reply('✅ පිළිතුර පරිශීලකයා වෙත සාර්ථකව යවන ලදී!');

                } catch (error) {
                    console.error('Reply යැවීමේ දෝෂය:', error);
                    ctx.reply('❌ පිළිතුර යැවීමේදී දෝෂයක් ඇති විය.');
                }
            } else {
                ctx.reply('❌ මුල් Chat ID එක සොයාගත නොහැක.');
            }
        }
        return; 
    }
    
    // C. පරිශීලක පණිවිඩය පරිපාලකයාට යොමු කිරීම
    if (ctx.from.id !== ADMIN_ID_NUM) {
        try {
            const forwardMessage = await ctx.forwardMessage(ADMIN_ID_NUM, ctx.message.chat.id);
            const infoMessage = `
**[Support Request]**
👤 User ID: ${ctx.from.id}
✉️ Chat ID: ${ctx.chat.id}
🔗 Forwarded Message ID: ${forwardMessage.message_id}
            
_පරිශීලකයාට පිළිතුරු දීමට, **මෙම** පණිවිඩයටම **Reply** කර පිළිතුර යවන්න._
            `;
            
            await bot.telegram.sendMessage(ADMIN_ID_NUM, infoMessage, {
                reply_to_message_id: forwardMessage.message_id 
            });
    
            ctx.reply('✅ ඔබගේ පණිවිඩය පරිපාලකවරයා වෙත යොමු කරන ලදී.', {
                 reply_to_message_id: ctx.message.message_id
            });
    
        } catch (error) {
            console.error('Forwarding දෝෂය:', error);
            await ctx.reply('❌ පණිවිඩය යොමු කිරීමේදී ගැටලුවක් ඇති විය.');
        }
    }
});


// ----------------------------------------------------------------------
// D. Vercel සඳහා Webhook සකස් කිරීම
// ----------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
    // Webhook mode: Vercel serverless environment
    console.log('Bot is running in Webhook Mode (Production)');
    
    // Vercel serverless function එකක් export කිරීම
    module.exports = async (req, res) => {
        try {
            // Telegram වෙතින් එන පණිවිඩය හැසිරවීම
            await bot.handleUpdate(req.body, res);
        } catch (err) {
            console.error('Error handling update:', err);
            res.status(500).send('Internal Server Error');
        }
    };
} else {
    // Polling mode: Local development
    console.log('Bot is running in Polling Mode (Development)');
    bot.launch(); 
}

// කේතය අවසන්