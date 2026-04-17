import { NextResponse } from 'next/server';
import { createUmamiClient, buildTimeRangeParams, UmamiTimeRange, UmamiTimeUnit } from '@/lib/umami';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get('id');

  const startAt = searchParams.get('startAt');
  const endAt   = searchParams.get('endAt');
  const unit    = searchParams.get('unit') as UmamiTimeUnit | null;

  const range: UmamiTimeRange =
    startAt && endAt
      ? { startAt: Number(startAt), endAt: Number(endAt), unit: unit ?? 'day' }
      : (searchParams.get('range') ?? '24h') as UmamiTimeRange;

  const client = createUmamiClient({
    baseUrl: process.env.UMAMI_BASE_URL ?? 'http://127.0.0.1:3000/api',
    username: process.env.UMAMI_USER ?? 'admin',
    password: process.env.UMAMI_PASS ?? 'umami',
    timezone: process.env.UMAMI_TIMEZONE ?? 'America/Sao_Paulo',
  });

  const all = searchParams.get('all') === 'true';

  try {
    await client.authenticate();

    const websites = await client.getWebsites();
    const params = buildTimeRangeParams(range);

    if (all) {
      if (!websites.length) {
        return NextResponse.json({ websites: [], results: [], error: 'Nenhum site encontrado' });
      }

      const results = await Promise.all(
        websites.map(async (site) => {
          const [stats, events, pageviews] = await Promise.all([
            client.getStats(site.id, params),
            client.getEvents(site.id, params),
            client.getPageviews(site.id, params),
          ]);
          return { id: site.id, stats, events, pageviews };
        })
      );

      return NextResponse.json({ websites, results });
    }

    const targetId = websiteId ?? (websites[0]?.id ?? null);

    if (!targetId) {
      return NextResponse.json({ websites, error: 'Nenhum site encontrado' });
    }

    const [stats, events, pageviews] = await Promise.all([
      client.getStats(targetId, params),
      client.getEvents(targetId, params),
      client.getPageviews(targetId, params),
    ]);

    return NextResponse.json({ websites, currentId: targetId, stats, events, pageviews });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar dados do Umami' }, { status: 500 });
  }
}
