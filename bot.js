import { WechatyBuilder } from 'wechaty'
import { FileBox } from 'file-box'
import { config } from './config.js'
import TelegramBot from "node-telegram-bot-api"

const token = config.token
const chatid = config.chatid;

const bot = new TelegramBot(token, { polling: true });
const contacs = Object.create(null);
const groups = Object.create(null);
var current_target = null;

function banned_group(name) {
  return (name.indexOf('UM') > -1) || (name.indexOf('几何') > -1) || (name.indexOf('恋爱') > -1)
}

function pretty_msg(contact, group, msg) {
  if (group) {
    // Group
    return `(${group}) ${contact.name()}: ${msg}`
  } else {
    // Private
    return `${contact.name()}: ${msg}`
  }
}

// throw new Error('Not implemented')

const wechaty = WechatyBuilder.build() // get a Wechaty instance

wechaty
  .on('scan', (qrcode, status) => console.log(`Scan QR Code to login: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`))
  .on('login', user => console.log(`User ${user} logged in`))
  .on('message', async msg => {
    const fts = [
      wechaty.Message.Type.Attachment,
      wechaty.Message.Type.Image,
      wechaty.Message.Type.Video,
    ]

    if (msg.age() > 60) {
      console.log('Message discarded because its TOO OLD(than 1 minute)')
      return
    }
    const contact = msg.talker()
    const text = msg.text()
    const room = msg.room()

    if (msg.type() !== wechaty.Message.Type.Text) {
      if (fts.includes(msg.type())) {
        var fb = null
        if (room) {
          // Group
          const topic = await room.topic()
          if (banned_group(topic)) {
            return
          }
          const key = `g${room.id.substring(2, 7)}`
          groups[key] = room
          console.log(`Room: ${topic} Id: ${key}`)
          fb = await msg.toFileBox()
          await fb.toFile(`tmp/${fb.name}`)
          bot.sendMessage(chatid, `${key}\n${pretty_msg(contact, topic, "Sent a file")}`);
        } else {
          // Private
          const key = `p${contact.id.substring(2, 7)}`
          contacs[key] = contact
          console.log(`Contact: ${contact.name()} Id: ${key}`)
          fb = await msg.toFileBox()
          await fb.toFile(`tmp/${fb.name}`)
          bot.sendMessage(chatid, `${key}\n${pretty_msg(contact, null, "Sent a file")}`);
        }
        if (msg.type() == wechaty.Message.Type.Audio) {
          bot.sendAudio(chatid, `tmp/${fb.name}`)
        } else if (msg.type() == wechaty.Message.Type.Image) {
          bot.sendPhoto(chatid, `tmp/${fb.name}`)
        }
        else {
          bot.sendDocument(chatid, `tmp/${fb.name}`)
        }
      } else {
        console.log('Message discarded because it is NOT a valid message')
        return
      }
      return
    }
    if (room) {
      // Group
      const topic = await room.topic()
      if (banned_group(topic)) {
        return
      }
      const key = `g${room.id.substring(2, 7)}`
      groups[key] = room
      console.log(`Room: ${topic} Id: ${key}`)
      bot.sendMessage(chatid, `${key}\n${pretty_msg(contact, topic, text)}`);
    } else {
      // Private
      const key = `p${contact.id.substring(2, 7)}`
      contacs[key] = contact
      console.log(`Contact: ${contact.name()} Id: ${key}`)
      bot.sendMessage(chatid, `${key}\n${pretty_msg(contact, null, text)}`);
    }
  })
wechaty.start()

bot.on('message', async (msg) => {
  if (msg.chat.id == chatid) {
    if (msg.reply_to_message) {
      // New target
      try {
        if (!msg.reply_to_message.text) {
          bot.sendMessage(chatid, 'Please reply to a text message');
          return
        }
        const target = msg.reply_to_message.text
        const fl = target.split('\n')[0]
        const q = fl[0]
        if (q == 'p') {
          current_target = contacs[fl]
        } else if (q == 'g') {
          current_target = groups[fl]
        } else {
          bot.sendMessage(chatid, 'Cannot find target');
        }
      } catch (err) {
        console.log(err)
        return
      }
    }
    if (!current_target) {
      bot.sendMessage(chatid, 'No target set');
      return
    }
    if (msg.photo) {
      const ds = await bot.downloadFile(msg.photo[msg.photo.length - 1].file_id, 'tmp')

      const filebox = FileBox.fromFile(ds)
      await current_target.say(filebox)
    }
    if (msg.document) {
      const ds = await bot.downloadFile(msg.document.file_id, 'tmp')
      const filebox = FileBox.fromFile(ds)
      await current_target.say(filebox)
    }
    if (msg.text) {
      current_target.say(msg.text)
    }

  }
})
