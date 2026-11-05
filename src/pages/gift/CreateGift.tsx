import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "../../components/Header";
import { StepHeader } from "../../components/StepHeader";
import { getAsset } from "../../data/assets";
import type { CreatedGift } from "../../chain/gift";
import { Checkout, Customize, Done, Preview, SelectAmount, SelectToken, type GiftDraft } from "./steps";

const TITLES = ["Select Token", "Select Amount", "Customize", "Preview Gift", "Checkout", "Gift Sent"];

const EMPTY: GiftDraft = {
  amount: 5,
  themeId: "asset",
  from: "",
  message: "",
  delivery: "link",
  recipientEmail: "",
  expiryDays: 30,
  coverSetup: true,
};

export default function CreateGift() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselected = getAsset(params.get("asset") ?? "");
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [draft, setDraft] = useState<GiftDraft>({ ...EMPTY, assetId: preselected?.id });
  const [created, setCreated] = useState<CreatedGift>();
  const update = (p: Partial<GiftDraft>) => setDraft((d) => ({ ...d, ...p }));
  const asset = draft.assetId ? getAsset(draft.assetId) : undefined;
  const next = () => setStep((s) => s + 1);

  const back = step > 0 && step < 5 ? () => setStep((s) => s - 1) : undefined;

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <Header signedIn />
      <main className={`mx-auto px-4 pb-16 sm:px-6 ${step === 4 ? "max-w-[640px]" : "max-w-[600px]"}`}>
        <StepHeader title={TITLES[step]} step={step} total={TITLES.length} onBack={back} />

        {step === 0 && (
          <SelectToken
            onSelect={(a) => {
              update({ assetId: a.id });
              next();
            }}
          />
        )}
        {step === 1 && asset && <SelectAmount asset={asset} amount={draft.amount} onChange={(amount) => update({ amount })} onContinue={next} />}
        {step === 2 && asset && <Customize asset={asset} draft={draft} update={update} onContinue={next} />}
        {step === 3 && asset && <Preview asset={asset} draft={draft} update={update} onContinue={next} />}
        {step === 4 && asset && (
          <Checkout
            asset={asset}
            draft={draft}
            update={update}
            onPurchased={(g) => {
              setCreated(g);
              next();
            }}
          />
        )}
        {step === 5 && asset && created && (
          <Done
            asset={asset}
            draft={draft}
            gift={created}
            onFinish={() => navigate("/app")}
            onAnother={() => {
              setDraft(EMPTY);
              setCreated(undefined);
              setStep(0);
            }}
          />
        )}
      </main>
    </div>
  );
}
