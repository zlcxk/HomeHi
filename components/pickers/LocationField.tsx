"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

export function LocationField({
  defaultValue = "",
  suggestions = [],
  label = "地点",
}: {
  defaultValue?: string;
  suggestions?: string[];
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const hints = suggestions.filter((place) => place !== value).slice(0, 4);

  return (
    <div>
      <label className="label" htmlFor="record-location">
        {label}
      </label>
      <div className="relative">
        <MapPin
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          id="record-location"
          name="location"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="在哪里"
          maxLength={200}
          className="field pl-9"
        />
      </div>
      {hints.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hints.map((place) => (
            <button
              key={place}
              type="button"
              onClick={() => setValue(place)}
              className="chip"
            >
              {place}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
