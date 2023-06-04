import { SlashCommandBuilder, EmbedBuilder, APIEmbedField } from "discord.js";
import { SlashCommand } from "../types";
import { Supabase } from "../services/supabase";
import { PositionItem, getUserPositions } from "../services/hxro";
import { PublicKey } from "@solana/web3.js";
import { MarketStatusEnum, calculateOdd } from "@hxronetwork/parimutuelsdk";
import { formatNumber } from "../utils/formatNumber";

const command: SlashCommand = {
  command: new SlashCommandBuilder()
    .setName("positions")
    .setDescription("Shows all positions"),
  execute: async (interaction) => {
    try {
      await interaction.deferReply();
      let { data: user, error } = await Supabase.from("hxro_users")
        .select("*")
        .eq("discord_id", interaction.user.id)
        .maybeSingle();

      if (!user || error)
        return interaction.editReply({
          content:
            "You don't have Hrxo wallet. Please run /deposit command to create a new one",
        });

      const positions = await getUserPositions(new PublicKey(user.sol_wallet!));

      if (positions.length === 0) {
        return interaction.editReply({
          content: "No position",
        });
      }

      const upcomingPositions: PositionItem[] = [];
      const livePositions: PositionItem[] = [];
      const settledPositions: PositionItem[] = [];

      positions.forEach((pos) => {
        if (pos.market.status === MarketStatusEnum.UPCOMING) {
          upcomingPositions.push(pos);
        } else if (pos.market.status === MarketStatusEnum.LIVE) {
          livePositions.push(pos);
        } else {
          settledPositions.push(pos);
        }
      });

      let fields: APIEmbedField[] = [];

      if (livePositions.length > 0) {
        fields.push({
          name: "Live",
          value:
            "--------------------------------------------------------------------------",
        });

        fields = [
          ...fields,
          ...livePositions
            .map((pos) => getPositionFields(pos))
            .reduce(
              (prev, current) => [...prev, ...current],
              [] as APIEmbedField[]
            ),
        ];
      }

      if (upcomingPositions.length > 0) {
        fields.push({
          name: "Upcoming",
          value:
            "--------------------------------------------------------------------------",
        });

        fields = [
          ...fields,
          ...upcomingPositions
            .map((pos) => getPositionFields(pos))
            .reduce(
              (prev, current) => [...prev, ...current],
              [] as APIEmbedField[]
            ),
        ];
      }

      if (settledPositions.length > 0) {
        fields.push({
          name: "Settled",
          value:
            "--------------------------------------------------------------------------",
        });

        fields = [
          ...fields,
          ...settledPositions
            .map((pos) => getPositionFields(pos))
            .reduce(
              (prev, current) => [...prev, ...current],
              [] as APIEmbedField[]
            ),
        ];
      }

      const embed = new EmbedBuilder()
        .setTitle("Your Positions")
        .addFields(...fields)
        .setTimestamp()
        .setFooter({
          text: "Type /feedback to report • Hxro bot•",
          iconURL: interaction.client.user?.avatarURL() || undefined,
        });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error(error);
      interaction.editReply({ content: "Something went wrong..." });
    }
  },
};

const getPositionFields = (pos: PositionItem): APIEmbedField[] => {
  const isLong = pos.position.long > 0;
  const positionSize = isLong ? pos.pool.long : pos.pool.short;

  let payout;
  if (pos.market.status === MarketStatusEnum.SETTLED) {
    const totalPool = pos.pool.short + pos.pool.long;
    if (
      pos.locked.price >= pos.settled.price &&
      pos.position.short &&
      pos.pool.short
    ) {
      payout = (pos.position.short / pos.pool.short) * totalPool;
    }

    if (
      pos.locked.price < pos.settled.price &&
      pos.position.long &&
      pos.pool.long
    ) {
      payout = (pos.position.long / pos.pool.long) * totalPool;
    }
  }

  return [
    {
      name: "Amount",
      value: `${isLong ? "⬆️" : "⬇️"} $${formatNumber(
        isLong ? pos.position.long / 10 : pos.position.short / 10
      )}`,
      inline: true,
    },
    {
      name: "Pair",
      value: pos.market.marketPair,
      inline: true,
    },
    {
      name: "Side",
      value: isLong ? "⬆️ LONG" : "⬇️ SHORT",
      inline: true,
    },
    {
      name: "Locked Price",
      value:
        pos.locked.price && pos.market.status !== MarketStatusEnum.UPCOMING
          ? `$${formatNumber(pos.locked.price)}`
          : "-",
      inline: true,
    },
    {
      name: "Pool Size",
      value: `$${formatNumber(pos.pool.poolSize)}/${calculateOdd(
        positionSize,
        pos.pool.poolSize
      )}X`,
      inline: true,
    },
    payout
      ? {
          name: "Payout",
          value: `$${formatNumber(payout / 10)}`,
          inline: true,
        }
      : {
          name: "Status",
          value:
            pos.market.status === MarketStatusEnum.SETTLED
              ? isLong
                ? pos.locked.price > pos.settled.price
                  ? "OTM"
                  : "-"
                : pos.settled.price > pos.locked.price
                ? "OTM"
                : "-"
              : "-",
          inline: true,
        },
  ];
};

export default command;
