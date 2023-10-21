import { WechatyBuilder } from 'wechaty'
import { FileBox } from 'file-box'
import { config } from './config.js'
import TelegramBot from "node-telegram-bot-api"
import Sp from 'sharp'

const token = config.token
const chatid = config.chatid;

const bot = new TelegramBot(token, { polling: true });
const targets = Object.create(null);
const msg_to_target = Object.create(null);
var current_target = null;


const banned_group = config.banned_group

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
    if (msg.self()) {
      return
    }

    const contact = msg.talker()
    const text = msg.text()
    const room = msg.room()

    if (msg.type() !== wechaty.Message.Type.Text) {
      if (fts.includes(msg.type())) {
        let fb = null
        if (room) {
          // Group
          const topic = await room.topic()
          if (banned_group(topic)) {
            return
          }
          const key = room.id
          targets[key] = room
          console.log(`Room: ${topic} Id: ${key}`)
          fb = await msg.toFileBox()
          await fb.toFile(`tmp/${fb.name}`)
          const msgid = await bot.sendMessage(chatid, pretty_msg(contact, topic, "Sent a file"));
          msg_to_target[msgid.message_id] = key
        } else {
          // Private
          const key = contact.id
          targets[key] = contact
          console.log(`Contact: ${contact.name()} Id: ${key}`)
          fb = await msg.toFileBox()
          await fb.toFile(`tmp/${fb.name}`)
          const msgid = await bot.sendMessage(chatid, pretty_msg(contact, null, "Sent a file"));
          msg_to_target[msgid.message_id] = key
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
        if (msg.type() == wechaty.Message.Type.Unknown) {
          console.log("Unknown message type")
          return
        }
        bot.sendMessage(chatid, pretty_msg(contact, null, "Sent a message that is not supported"));
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
      const key = room.id
      targets[key] = room
      console.log(`Room: ${topic} Id: ${key}`)
      const msgid = await bot.sendMessage(chatid, pretty_msg(contact, topic, text));
      msg_to_target[msgid.message_id] = key
    } else {
      // Private
      const key = contact.id
      targets[key] = contact
      console.log(`Contact: ${contact.name()} Id: ${key}`)
      const msgid = await bot.sendMessage(chatid, pretty_msg(contact, null, text));
      msg_to_target[msgid.message_id] = key
    }
  })
wechaty.start()

bot.on('message', async (msg) => {
  if (msg[0] == '/') {
    // Command mode
    const cmd = msg.split(' ')[0]
    if (cmd == '/help') {
      const text = `Commands:\n
      /help - Show this message\n
      /search - Search for a contact\n
      /set - Set target\n`
      await bot.sendMessage(chatid, text);
      return
    }
    if (cmd == '/search') {
      const name = msg.substring(cmd.length + 1)
      const contactFindByName = await wechaty.Contact.findAll({ name: name })
      const contactFindByAlias = await wechaty.Contact.findAll({ alias: name })
      let cid = 0
      let text = ""
      for (const contact of contactFindByName) {
        text += `${cid}: ${contact.name()}\n`
        cid++
      }
      const alias_start = cid
      for (const contact of contactFindByAlias) {
        text += `${cid}: ${contact.name()}\n`
        cid++
      }
      if (cid == 0) {
        bot.sendMessage(chatid, `Cannot find ${name}`);
        return
      }
      await bot.sendMessage(chatid, text);
    }
    if (cmd == '/set') {
      const name = msg.substring(cmd.length + 1)
      const contactFindByName = await wechaty.Contact.find({ name: name })
      const contactFindByAlias = await wechaty.Contact.findAll({ alias: name })
      if (contactFindByName) {
        current_target = contactFindByName
        bot.sendMessage(chatid, `Set target to ${contactFindByName.name()}`);
        return
      }
      if (contactFindByAlias) {
        current_target = contactFindByAlias
        bot.sendMessage(chatid, `Set target to ${contactFindByAlias.name()}`);
        return
      }
      bot.sendMessage(chatid, `Cannot find ${name}`);
    }
    return
  }
  if (msg.chat.id == chatid) {
    if (msg.reply_to_message) {
      // New target
      try {
        if (!msg.reply_to_message.text) {
          bot.sendMessage(chatid, 'Please reply to a text message');
          return
        }
        const target = msg_to_target[msg.reply_to_message.message_id]
        if (target && targets[target]) {
          current_target = targets[target]
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
    if (msg.sticker) {
      if (msg.sticker.is_animated || msg.sticker.is_video) {
        bot.sendMessage(chatid, 'Animated stickers are not supported');
        return
      }
      const ds = await bot.downloadFile(msg.sticker.file_id, 'tmp')
      await Sp(ds).flatten({ background: '#ffffff' }).toFile('tmp/output.jpg')
      const filebox = FileBox.fromFile('tmp/output.jpg')
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
