import { _api } from "@iconify/vue";

function noIconsOnline(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 404 }));
}

export function keepIconsOffline(): void {
  _api.setFetch(noIconsOnline);
}
