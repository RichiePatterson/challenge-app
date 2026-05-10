import { supabase } from "../supabase";

export async function savePoints(activityType, activityName, points) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No logged-in user");
  }

  const { error } = await supabase.from("points_log").insert({
    user_id: user.id,
    activity_type: activityType,
    activity_name: activityName,
    points,
  });

  if (error) throw error;
}