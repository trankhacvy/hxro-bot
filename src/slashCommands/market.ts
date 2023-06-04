import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonBuilder,
  CommandInteraction,
  Message,
} from "discord.js";
import * as sdk from "@hxronetwork/parimutuelsdk";
import * as bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { SlashCommand } from "../types";
import { PariObj, getContests, placeOrder } from "../services/hxro";
import { Supabase } from "../services/supabase";

const durationChoices = [
  {
    name: "One minute",
    value: 60,
  },
  {
    name: "Five minutes",
    value: 300,
  },
  {
    name: "Fifteen minutes",
    value: 900,
  },
  {
    name: "One hour",
    value: 3600,
  },
  {
    name: "One day",
    value: 86400,
  },
];

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("market")
    .setDescription("Show market")
    .addStringOption((option) => {
      return option
        .setName("pair")
        .setDescription("Token pair")
        .setRequired(true)
        .addChoices(
          {
            name: "BTC_USD",
            value: "BTCUSD",
          },
          {
            name: "SOL_USD",
            value: "SOLUSD",
          },
          {
            name: "ETH_USD",
            value: "ETHUSD",
          },
          {
            name: "HXRO_USD",
            value: "HXROUSD",
          }
        );
    })
    .addNumberOption((option) => {
      return option
        .setName("duration")
        .setDescription("Duration")
        .setRequired(true)
        .addChoices(...durationChoices);
    }),
  execute: async (interaction) => {
    try {
      await interaction.deferReply();
      const options: { [key: string]: string | number | boolean } = {};
      if (!interaction.options) {
        return await interaction.editReply({
          content: "Something went wrong...",
        });
      }

      for (let i = 0; i < interaction.options.data.length; i++) {
        const element = interaction.options.data[i];
        if (element.name && element.value)
          options[element.name] = element.value;
      }

      const contest = await getContests(
        options.pair as string,
        options.duration as number
      );

      const embed = new EmbedBuilder()
        .setColor("DarkRed")
        .setTitle("Live contest")
        .setDescription(
          `Duration: ${
            durationChoices.find(
              (choice) => choice.value === (options.duration as number)
            )?.name ?? "-"
          }`
        )
        .addFields(
          { name: "Short Pool", value: contest.shortPool, inline: true },
          { name: "Long Pool", value: contest.longPool, inline: true },
          { name: "  ", value: "  ", inline: true },
          { name: "Short Odds", value: contest.shortOdds, inline: true },
          { name: "Long Odds", value: contest.longOdds, inline: true },
          { name: "  ", value: "  ", inline: true },
          { name: "Start in", value: contest.startIn }
        )
        .setTimestamp()
        .setFooter({
          text: "Type /feedback to report • Hxro bot•",
          iconURL: interaction.client.user?.avatarURL() || undefined,
        });

      const confirm = new ButtonBuilder()
        .setCustomId("btn-long")
        .setLabel("Long")
        .setStyle(ButtonStyle.Primary);

      const cancel = new ButtonBuilder()
        .setCustomId("btn-short")
        .setLabel("Short")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(confirm, cancel);

      const response = await interaction.editReply({
        embeds: [embed],
        // @ts-ignore
        components: [row],
      });

      await handleButtons(interaction, response, contest);
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: "Something went wrong..." });
    }
  },
};

const handleButtons = async (
  interaction: CommandInteraction,
  response: Message<boolean>,
  contest: PariObj
) => {
  try {
    const discordId = interaction.user.id;

    const confirmation = await response.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60_000,
    });
    await confirmation.deferUpdate();

    let { data: user, error } = await Supabase.from("hxro_users")
      .select("*")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (!user || error)
      return await interaction.followUp({
        content:
          "You don't have Hrxo wallet. Please run /deposit command to create a new one",
      });

    const actionId = confirmation.customId;

    interaction
      .followUp({
        content: "Enter the amount you want to bet",
        fetchReply: true,
      })
      .then(async () => {
        const collected = await interaction.channel?.awaitMessages({
          filter: (msg) => msg.author.id === interaction.user.id,
          max: 1,
          time: 30000,
          errors: ["time"],
        });

        if (!collected || !collected?.first) {
          return await interaction.followUp({
            content: "Something went wrong...",
          });
        }

        const message = collected.first();

        let amount = 0;
        try {
          amount = parseFloat(message?.content ?? "");
        } catch (error) {
          return await interaction.followUp({
            content: "Invalid amount number",
          });
        }

        const side =
          actionId === "btn-long"
            ? sdk.PositionSideEnum.LONG
            : sdk.PositionSideEnum.SHORT;

        try {
          const txId = await placeOrder(
            Keypair.fromSecretKey(bs58.decode(user?.sol_wallet_prv!)),
            contest.pubkey,
            amount,
            side
          );

          const embed = new EmbedBuilder()
            .setTitle("Order placed successfully")
            .setDescription(`Click the URL to view you transaction`)
            .setURL(`https://solscan.io/tx/${txId}?cluster=devnet`)
            .setTimestamp()
            .setFooter({
              text: "Type /feedback to report • Hxro bot•",
              iconURL: interaction.client.user?.avatarURL() || undefined,
            });

          return await interaction.followUp({
            embeds: [embed],
          });
        } catch (error) {
          console.error(error);
          return await interaction.followUp({
            content: `Something went wrong...`,
          });
        }
      })
      .catch(async () => {
        await interaction.editReply({
          components: [],
        });
      });
  } catch (e) {
    console.error(e);
    await interaction.editReply({
      components: [],
    });
  }
};

export default command;
