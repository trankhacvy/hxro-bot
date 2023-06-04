import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import * as bs58 from "bs58";
import { SlashCommand } from "../types";
import { Supabase } from "../services/supabase";
import { Keypair } from "@solana/web3.js";

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Deposit your token into discord wallet")
    .addStringOption((option) => {
      return option
        .setName("token")
        .setDescription("The token symbol which you wanna deposit")
        .setRequired(true)
        .addChoices(
          {
            name: "SOL",
            value: "SOL",
          },
          {
            name: "USDC",
            value: "USDC",
          },
          {
            name: "HXRO",
            value: "HXRO",
          },
          {
            name: "BTC",
            value: "BTC",
          },
          {
            name: "ETH",
            value: "ETH",
          }
        );
    }),
  execute: async (interaction) => {
    try {
      await interaction.deferReply();

      const options: { [key: string]: string | number | boolean } = {};
      if (!interaction.options)
        return await interaction.editReply({
          content: "Something went wrong...",
        });

      for (let i = 0; i < interaction.options.data.length; i++) {
        const element = interaction.options.data[i];
        if (element.name && element.value)
          options[element.name] = element.value;
      }

      let { data: user, error } = await Supabase.from("hxro_users")
        .select("*")
        .eq("discord_id", interaction.user.id)
        .maybeSingle();

      if (!user || error) {
        let keypair = Keypair.generate();

        const { data, error: createError } = await Supabase.from("hxro_users")
          .insert({
            discord_id: interaction.user.id,
            discord_name: interaction.user.username,
            sol_wallet: keypair.publicKey.toBase58(),
            sol_wallet_prv: bs58.encode(keypair.secretKey),
          })
          .select("*")
          .maybeSingle();

        if (!data || createError) {
          return await interaction.editReply({
            content: "Something went wrong...",
          });
        }

        user = data;
      }

      const embed = new EmbedBuilder()
        .setTitle("Deposit tokens")
        .setDescription(
          "Below is the deposit address linked to your Discord account. Please copy your deposit address and paste it into your third-party wallet or exchange."
        )
        .addFields({ name: "Address", value: user.sol_wallet })
        .setTimestamp()
        .setFooter({
          text: "Type /feedback to report • Hxro bot•",
          iconURL: interaction.client.user?.avatarURL() || undefined,
        });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      interaction.editReply({ content: "Something went wrong..." });
    }
  },
};

export default command;
