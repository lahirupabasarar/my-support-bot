// index.js

// 1. අවශ්‍ය මොඩියුල (Modules) ආයාත කිරීම
require('dotenv').config(); 
const { Telegraf } = require('telegraf');

// 2. විචල්‍යයන් (Variables) නිර්වචනය කිරීම
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 

// 3. Bot එක ආරම්භ කිරීමට පෙර පරීක්ෂා කිරීම
if (!BOT_TOKEN || !ADMIN_ID) {
    console.error("දෝෂය: BOT_TOKEN හෝ ADMIN_ID .env ගොනුවේ සොයාගත නොහැක. කරුණාකර .env ගොනුව පරීක්ෂා කරන්න.");
    process.exit(1); 
}

const ADMIN_ID_NUM = parseInt(ADMIN_ID, 10); 

const bot = new Telegraf(BOT_TOKEN);

// ----------------------------------------------------------------------
// A. /start විධානය හැසිරවීම (Handle /start command)
// ----------------------------------------------------------------------
bot.start((ctx) => {
    // පරිශීලකයාට පිළිතුරු යැවීම
    ctx.reply(
        '👋 ආයුබෝවන්! මම සහාය (Support) ලබා දෙන bot කෙනෙක්. ' +
        'ඔබට ඇති ඕනෑම ප්‍රශ්නයක් හෝ ගැටලුවක් මෙහි සටහන් කරන්න. ' +
        'පරිපාලකවරයා ඉතා ඉක්මනින් ඔබට පිළිතුරු දෙනු ඇත.'
    );

    // Admin ID එකට නව පරිශීලකයෙක් පැමිණි බවට දැනුම්දීම (විකල්ප)
    if (ctx.from.id !== ADMIN_ID_NUM) {
         bot.telegram.sendMessage(ADMIN_ID_NUM, `නව පරිශීලකයෙක් bot එක ආරම්භ කළා: @${ctx.from.username || ctx.from.id}`);
    }
});


// ----------------------------------------------------------------------
// B. පරිපාලකයාගේ පිළිතුර හසුරුවන කොටස (Handle Admin Reply)
// ----------------------------------------------------------------------
bot.on('message', async (ctx) => {
    const message = ctx.message;

    // පණිවිඩය Admin ගෙන්දැයි පරීක්ෂා කිරීම AND එය Reply එකක්දැයි පරීක්ෂා කිරීම
    if (ctx.from.id === ADMIN_ID_NUM && message.reply_to_message) {
        
        const repliedMessage = message.reply_to_message;
        
        // Reply කළේ Chat ID සහ User ID අඩංගු Support Request පණිවිඩයටදැයි පරීක්ෂා කිරීම
        if (repliedMessage.text && repliedMessage.text.includes('Support Request') && repliedMessage.text.includes('Chat ID')) {
            
            // 🚨🚨🚨 නිවැරදි කළ Regex කොටස 🚨🚨🚨
            // Backticks (`) ඉවත් කර, සරලව ඕනෑම ඉලක්කම් මාලාවක් සොයයි.
            const chatIdMatch = repliedMessage.text.match(/Chat ID:\s*`?(-?\d+)/); 
            
            if (chatIdMatch && chatIdMatch[1]) {
                const targetChatId = chatIdMatch[1];
                const replyText = message.text; // Admin ගේ සැබෑ පිළිතුර

                try {
                    // 1. පරිශීලකයාට පිළිතුර යැවීම
                    await bot.telegram.sendMessage(targetChatId, `📣 **පරිපාලක පිළිතුර:**\n\n${replyText}`, {
                        parse_mode: 'Markdown'
                    });

                    // 2. Admin හට සාර්ථකත්ව පණිවිඩය යැවීම
                    ctx.reply('✅ පිළිතුර පරිශීලකයා වෙත සාර්ථකව යවන ලදී!');

                } catch (error) {
                    // දෝෂයක් ඇත්නම් (උදා: පරිශීලකයා bot එක block කර තිබේ නම්)
                    console.error('Reply යැවීමේ දෝෂය:', error);
                    ctx.reply('❌ පිළිතුර යැවීමේදී දෝෂයක් ඇති විය. (පරිශීලකයා Bot එක Block කර තිබිය හැක.)');
                }
            } else {
                // දෝෂ පණිවිඩය 
                ctx.reply('❌ මුල් Chat ID එක සොයාගත නොහැක. ඔබ නිවැරදි "Support Request" පණිවිඩයටම Reply කළාදැයි පරීක්ෂා කරන්න.');
                console.error('Chat ID Regex අසමත් විය:', repliedMessage.text);
            }
        } else if (repliedMessage.forward_from || repliedMessage.text) {
             // Admin, වෙනත් පණිවිඩයකට Reply කළොත් (Support Request එක නොවන)
             ctx.reply('🚫 කරුණාකර, පරිශීලකයාගේ පණිවිඩයට ඉහළින් ඇති *[Support Request]* ආරම්භ වන පණිවිඩයටම (එහි Chat ID අඩංගු නිසා) Reply කරන්න.');
        }

        // Admin reply එකක් යවා ඇති නිසා, අපි මෙම function එක නවත්වමු
        return; 
    }
    
    // Admin නොවන අයගේ පණිවිඩ (සාමාන්‍ය පරිශීලකයන්) මෙතැන් සිට Forward වේ
    if (ctx.from.id !== ADMIN_ID_NUM) {
         // C. පරිශීලක පණිවිඩය පරිපාලකයාට යොමු කිරීම (Forwarding)
        try {
            // A. පණිවිඩය Admin වෙත Forward කිරීම
            const forwardMessage = await ctx.forwardMessage(ADMIN_ID_NUM, ctx.message.chat.id);
    
            // B. Admin ට පිළිතුරු දීමට අවශ්‍ය දත්ත යැවීම
            // මෙහිදී Backticks ඉවත් කර, සරල Text පමණක් යවමු. (එවිට Markdown ගැටලු මඟහරී)
            const infoMessage = `
**[Support Request]**
👤 User ID: ${ctx.from.id}
✉️ Chat ID: ${ctx.chat.id}
🔗 Forwarded Message ID: ${forwardMessage.message_id}
            
_පරිශීලකයාට පිළිතුරු දීමට, ඔබ ලැබූ Forwarded පණිවිඩයට ඉහළින් ඇති **මෙම** පණිවිඩයටම **Reply** කර ඔබගේ පිළිතුර යවන්න._
            `;
            
            // parse_mode ඉවත් කර plain text ලෙස යැවීම.
            await bot.telegram.sendMessage(ADMIN_ID_NUM, infoMessage, {
                reply_to_message_id: forwardMessage.message_id 
            });
    
            // C. පරිශීලකයාට තහවුරු කිරීමේ පණිවිඩය යැවීම
            ctx.reply('✅ ඔබගේ පණිවිඩය පරිපාලකවරයා වෙත යොමු කරන ලදී. කෙටි කලකින් පිළිතුරක් බලාපොරොත්තු වන්න.', {
                 reply_to_message_id: ctx.message.message_id
            });
    
        } catch (error) {
            console.error('Forwarding දෝෂය:', error);
            await ctx.reply('❌ පණිවිඩය යොමු කිරීමේදී ගැටලුවක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.');
        }
    }
});


// ----------------------------------------------------------------------
// D. Bot එක ආරම්භ කිරීම
// ----------------------------------------------------------------------
bot.launch();

console.log('Support Bot සාර්ථකව ආරම්භ විය!');

// වැඩසටහන නැවතුනහොත් gracefully stop කිරීමට
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// කේතය අවසන්