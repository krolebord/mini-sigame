import { z } from 'zod';
import { numeric } from 'zod-form-data';

const primitiveSchema = z.union([z.string(), z.number(), z.boolean()]);

const atomMediaSchema = z
  .object({
    meta_type: z.string(),
    '#text': z.string(),
  })
  .transform((atom) => ({
    type: atom.meta_type,
    filename: atom['#text'].slice(1),
  }));

const atomNodeSchema = z
  .union([primitiveSchema, atomMediaSchema])
  .transform((atom) => [atom]);

const questionSchema = z.object({
  meta_price: numeric(),
  right: z.object({
    answer: z
      .union([atomNodeSchema, z.array(atomNodeSchema)])
      .transform((node) => node.flatMap((x) => x)),
  }),
  scenario: z.object({
    atom: z
      .union([atomNodeSchema, z.array(atomNodeSchema)])
      .transform((node) => node.flatMap((x) => x)),
  }),
})

const normalRoundSchema = z
  .object({
    meta_name: z.string(),
    meta_type: z.undefined(),
    themes: z.object({
      theme: z.array(
        z.object({
          meta_name: z.string(),
          questions: z.object({
            question: z.union([
              z.array(questionSchema),
              questionSchema.transform(x => [x]),
            ]),
          }),
        })
      ),
    }),
  })
  .transform((round) => {
    return {
      name: round.meta_name,
      themes: round.themes.theme.map((theme) => ({
        name: theme.meta_name,
        questions: theme.questions.question.map((question) => ({
          price: question.meta_price,
          answer: question.right.answer,
          scenario: question.scenario.atom,
        })),
      })),
    };
  });

const finalRoundSchema = z
  .object({
    meta_name: z.string(),
    meta_type: z.literal('final'),
  })
  .transform((round) => {
    return {
      name: round.meta_name,
      type: round.meta_type,
    };
  });

const roundSchema = z
  .array(z.union([normalRoundSchema, finalRoundSchema]))
  .transform((round) => {
    // TODO Add support for final rounds
    return round.filter((round): round is NormalRound => !('type' in round));
  });

type NormalRound = z.infer<typeof normalRoundSchema>;

export const manifestSchema = z
  .object({
    host: z.string(),
    package: z.object({
      meta_name: z.string(),
      rounds: z.object({
        round: roundSchema,
      }),
    }),
  })
  .transform((manifest) => {
    return {
      host: manifest.host,
      name: manifest.package.meta_name,
      rounds: manifest.package.rounds.round,
    };
  });

export type QuestionNode = z.infer<typeof atomNodeSchema>[number];

export type AnswerNode = z.infer<typeof atomNodeSchema>[number];

export type StoredManifest = z.infer<typeof manifestSchema> & {
  packKey: string;
};

function getPackKVKey(packKey: string) {
  return `pack:${packKey}`;
}

export async function putPack(kv: KVNamespace, manifest: StoredManifest) {
  const kvKey = getPackKVKey(manifest.packKey);
  const value = JSON.stringify(manifest);
  await kv.put(kvKey, value);
}

export async function getPack(kv: KVNamespace, packKey: string) {
  const kvKey = getPackKVKey(packKey);
  const value = await kv.get(kvKey);
  if (!value) {
    return null;
  }
  return JSON.parse(value) as StoredManifest;
}
