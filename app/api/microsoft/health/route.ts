import {userId} from '../../../lib/runtime';
import {microsoftHealth} from '../../../lib/microsoft-health';
export async function GET(request:Request) {
  return Response.json({checks:await microsoftHealth(userId(request))},{headers:{'Cache-Control':'no-store'}});
}
