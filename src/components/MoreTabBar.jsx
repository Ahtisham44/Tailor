import { useLocation, useNavigate } from "react-router-dom"
import { useLang } from "@/hooks/useLang"
import { tr } from "@/lib/config"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Route-aware shadcn tab strip shown at the top of every "More" section page.
// Each item is its own route; the active route is highlighted. Mobile-only —
// on desktop the sidebar already lists all of these destinations (the wrapper
// is hidden above 640px via .more-tabs-wrap). Logout now lives on the Profile
// page, so it is no longer part of this strip.
export default function MoreTabBar({ items = [] }) {
  const { lang } = useLang()
  const location = useLocation()
  const navigate = useNavigate()
  const current = location.pathname.replace("/", "") || "dashboard"

  if (!items.length) return null

  return (
    <div className="more-tabs-wrap justify-start w-full overflow-x-scroll scrrollbar-none" data-tour="more-tabs">
      <Tabs value={current} onValueChange={(id) => navigate("/" + id)} className="mb-4">
        <TabsList className="h-auto flex-nowrap">
          {items.map(it => (
            <TabsTrigger className="py-1" key={it.id} value={it.id}>
              {tr(it.id, lang)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
