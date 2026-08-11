export default async () => {
  return new Response(JSON.stringify({
    ok: true,
    service: "piutang-health",
    message: "Netlify Functions aktif",
    time: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
};
