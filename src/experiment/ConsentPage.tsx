/**
 * ConsentPage.tsx — informed consent, shown once, before anything else.
 *
 * WHAT CHANGED FROM THE PREVIOUS STUDY'S CONSENT
 * The wording is carried over from the earlier experiment's DemographicPage, but three things
 * had to change and one of them is not cosmetic:
 *
 *   1. THE STUDY IS DIFFERENT. The old text described wildfire scenarios and five AI expert
 *      agents. This study is four short question blocks, five emergency situations with six
 *      options each, a results page and a feedback page.
 *
 *   2. IT IS NO LONGER ANONYMOUS. The old text promised "No names, emails, or identifiable
 *      information will be collected." This study collects an email address, so that promise
 *      would now be false. The study is CONFIDENTIAL, not anonymous, and the Privacy section
 *      says so in those words. Saying it plainly is not optional: a participant who later
 *      discovers an unmentioned identifier has been collected has been misled, whatever the
 *      intention was.
 *
 *   3. COMPENSATION IS PART OF THE CONSENT. The email exists for two reasons — returning to an
 *      unfinished session, and receiving the gift card — and a participant has to know both
 *      before they hand it over, not after.
 *
 * CONSENT_VERSION
 * Stamped onto every consent record. If this text is ever edited, bump it. Without a version you
 * cannot say which wording a given participant actually agreed to, which is the first question
 * asked when a consent form changes mid-study.
 *
 * THE PROLIFIC DOOR (since 6 October 2026; Step 2 of docs/PROLIFIC_CONVERSION_PLAN.md, section 4.B). The same page and
 * design, with Prolific's terms where the university's differ, because Prolific's rules differ:
 *   - paid through Prolific (the amount shown there), not a $5 gift card by email;
 *   - no "35 active minutes" rule: Prolific does not allow refusing pay for time or for the researcher's own measures
 *     (active time is still measured, for the analysis);
 *   - one sitting, within Prolific's time limit (a page closed by accident continues from Prolific's link);
 *   - no email: the answers are stored with the Prolific ID;
 *   - the attention rule in Prolific's terms: failing two or more checks may lead to a rejected submission;
 *   - one agreement box, and "I do not agree", which says how to return the study on Prolific;
 *   - withdrawal through a Prolific message (or the researcher's email) with the Prolific ID.
 * Its own version stamp (PROLIFIC_CONSENT_VERSION). The university door's wording is unchanged, word for word.
 * The ethics board must approve this text before the Prolific door opens to participants.
 *
 * THE BUTTON IS DISABLED UNTIL THE BOX IS TICKED
 * Deliberate, and not merely a validation convenience: the tick is the consent record. A page
 * that can be walked past without it produces participants whose agreement was never given.
 */

import { useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Link,
  Separator,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuArrowRight, LuCheck, LuClock, LuGift, LuLock, LuShieldCheck, LuUndo2, LuWallet } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import { REQUIRED_ACTIVE_MINUTES } from "./dbShape";
import type { RecruitmentSource } from "./recruitment";

/** Bump whenever the consent wording below changes. Stored with every consent record. */
export const CONSENT_VERSION = "2026-09-14b";
/** The Prolific door's wording (since 6 October 2026). Bump it whenever that wording changes. */
export const PROLIFIC_CONSENT_VERSION = "2026-10-06-prolific";

/** What a participant agreed to, and when. Written to storage by the caller. */
export interface ConsentRecord {
  agreed: boolean;
  timestamp: string;
  version: string;
  /** True when the participant also ticked the payment-rules box. */
  compensation_rules_agreed?: boolean;
}

/** Contact details, kept in one place so the page and any later document cannot drift apart. */
const CONTACT = {
  researcher: {
    name: "Waseem Samkari, Ph.D. Candidate",
    unit: "College of Engineering and Science",
    school: "Florida Institute of Technology",
    email: "wsamkari2022@my.fit.edu",
  },
  irb: {
    name: "Dr. Jignya Patel, IRB Chairperson",
    address: "150 West University Blvd., Melbourne, FL 32901",
    email: "FIT_IRB@fit.edu",
  },
} as const;

/** One titled block of consent text. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack align="stretch" gap="2">
      <Heading size="sm" color="fg" letterSpacing="tight">
        {title}
      </Heading>
      <VStack align="stretch" gap="2" fontSize="sm" color="fg.muted" lineHeight="tall">
        {children}
      </VStack>
    </VStack>
  );
}

/**
 * A section that carries a promise the participant is relying on, so it is given a border and an
 * icon rather than being one more paragraph in a long scroll. Privacy and compensation are the
 * two things people actually need to find again later.
 */
/**
 * One condition of the payment: a check mark, the claim in bold, then the detail.
 *
 * A shared row rather than four hand-built paragraphs. These four lines are the only text on the
 * page a participant could later say they had not noticed, and four paragraphs that drift apart in
 * weight or spacing read as four unrelated remarks rather than as one list of conditions.
 */
function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <HStack align="start" gap="2.5">
      <Icon boxSize="4" color="orange.fg" mt="1" flexShrink={0}>
        <LuCheck />
      </Icon>
      <Text>
        <Text as="span" color="fg" fontWeight="semibold">
          {title}
        </Text>{" "}
        {children}
      </Text>
    </HStack>
  );
}

function Highlight({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box borderWidth="1px" borderColor="border.emphasized" bg="bg.subtle" rounded="xl" p={{ base: "4", md: "5" }}>
      <HStack gap="2.5" mb="2" align="center">
        <Icon boxSize="4" color="fg">
          {icon}
        </Icon>
        <Heading size="sm" color="fg" letterSpacing="tight">
          {title}
        </Heading>
      </HStack>
      <VStack align="stretch" gap="2" fontSize="sm" color="fg.muted" lineHeight="tall">
        {children}
      </VStack>
    </Box>
  );
}

/* ------------------------------------------------------------------------------------- THE PROLIFIC DOOR */

/** One sitting, within Prolific's time limit (it replaces "You Can Stop and Come Back"). */
function ProlificSitting() {
  return (
    <Highlight icon={<LuClock />} title="One Sitting, Within Prolific's Time Limit">
      <Text>
        Please complete the study in one sitting, within the time limit Prolific shows you. If the page closes by
        accident, open the study again from Prolific: you will continue from where you stopped.
      </Text>
    </Highlight>
  );
}

/** The payment through Prolific, and what completes the study (it replaces the gift-card panel). */
function ProlificPayment() {
  return (
    <Box data-prolific-payment borderWidth="2px" borderColor="orange.solid" bg="orange.subtle" rounded="xl" p={{ base: "4", md: "5" }}>
      <HStack gap="2.5" mb="3" align="center">
        <Icon boxSize="5" color="orange.fg">
          <LuWallet />
        </Icon>
        <Heading size="sm" color="fg" letterSpacing="tight">
          Your Payment Through Prolific
        </Heading>
      </HStack>
      <Text fontSize="sm" color="fg.muted" lineHeight="tall">
        Everyone who completes the study is paid{" "}
        <Text as="span" color="fg" fontWeight="semibold">
          through Prolific
        </Text>
        , the amount shown in the study on Prolific. Every submission is reviewed before it is paid.
      </Text>
      <HStack gap="2.5" mt="4" mb="3" align="center">
        <Icon boxSize="4" color="orange.fg">
          <LuCheck />
        </Icon>
        <Text fontSize="xs" fontWeight="bold" color="orange.fg" textTransform="uppercase" letterSpacing="wider">
          What completes it
        </Text>
      </HStack>
      <VStack align="stretch" gap="3" fontSize="sm" color="fg.muted" lineHeight="tall">
        <Rule title="Reach the end.">
          Answer the feedback questions and arrive at the final page. There you receive your completion code, and a
          button takes you back to Prolific.
        </Rule>
        <Rule title="Answer the attention checks as asked.">
          A few simple questions check that you are reading. If you fail two or more of them, your submission may be
          rejected.
        </Rule>
        <Rule title="Answer thoughtfully.">
          A submission that shows clear low effort throughout, such as the same answer to every question, may be
          rejected.
        </Rule>
      </VStack>
    </Box>
  );
}

/** Privacy without an email (it replaces "Privacy and Your Email"). */
function ProlificPrivacy() {
  return (
    <Highlight icon={<LuLock />} title="Privacy and Your Prolific ID">
      <Text color="fg" fontWeight="semibold">
        We never ask for your name or your email.
      </Text>
      <Text>
        Your answers are stored with your Prolific ID, which we use only to pay you and to let you continue if the page
        closes. Your Prolific ID is seen only by the research team and is never shown to anyone else taking part.
      </Text>
      <Text>
        Your answers are analyzed and reported as group results, so no individual can be identified in anything we
        publish. Data is kept on secure, password-protected storage accessible only to the research team.
      </Text>
    </Highlight>
  );
}

/** The agreement for the Prolific door: one box, and a way to decline that says how to return the study. */
function ProlificAgreement({ onAgree }: { onAgree: (record: ConsentRecord) => void }) {
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);
  if (declined) {
    return (
      <Box data-prolific-declined borderWidth="2px" borderColor="border.emphasized" bg="bg.panel" rounded="2xl" p={{ base: "5", md: "6" }}>
        <HStack gap="2.5" mb="3" align="center">
          <Icon boxSize="4" color="fg.muted">
            <LuUndo2 />
          </Icon>
          <Heading size="sm" color="fg" letterSpacing="tight">
            Thank you for considering the study
          </Heading>
        </HStack>
        <Text fontSize="sm" color="fg.muted" lineHeight="tall">
          You have not agreed, so nothing has been recorded. Please go back to Prolific and return the study by choosing{" "}
          <Text as="span" color="fg" fontWeight="semibold">
            &ldquo;Stop without completing&rdquo;
          </Text>
          . No completion code is needed.
        </Text>
        <Button mt="4" size="sm" variant="ghost" rounded="lg" color="fg.muted" onClick={() => setDeclined(false)}>
          Go back to the information
        </Button>
      </Box>
    );
  }
  return (
    <Box
      data-prolific-agreement
      borderWidth="2px"
      borderColor={checked ? "green.solid" : "border.emphasized"}
      bg="bg.panel"
      rounded="2xl"
      p={{ base: "5", md: "6" }}
      transition="border-color 0.2s ease"
    >
      <HStack gap="2.5" mb="3" align="center">
        <Icon boxSize="4" color={checked ? "green.fg" : "fg.subtle"}>
          <LuShieldCheck />
        </Icon>
        <Heading size="sm" color="fg" letterSpacing="tight">
          Agreement
        </Heading>
      </HStack>
      <Checkbox checked={checked} onCheckedChange={(e) => setChecked(!!e.checked)} colorPalette="green" alignItems="flex-start" cursor="pointer">
        <Text fontSize="sm" color="fg" lineHeight="tall">
          I have read the information above. I voluntarily agree to take part, and I understand how the study is paid
          through Prolific and that the attention checks must be answered as asked.
        </Text>
      </Checkbox>
      <Button
        mt="5"
        size="lg"
        w="full"
        colorPalette="green"
        bg={checked ? "green.solid" : "bg.muted"}
        color={checked ? "green.contrast" : "fg.subtle"}
        _hover={checked ? { opacity: 0.92 } : {}}
        rounded="lg"
        fontWeight="semibold"
        gap="2"
        disabled={!checked}
        onClick={() => {
          if (!checked) return;
          onAgree({ agreed: true, timestamp: new Date().toISOString(), version: PROLIFIC_CONSENT_VERSION });
        }}
      >
        I agree — continue
        <Icon boxSize="4">
          <LuArrowRight />
        </Icon>
      </Button>
      {!checked && (
        <Text mt="2.5" fontSize="xs" color="fg.subtle" textAlign="center">
          Tick the box above to continue.
        </Text>
      )}
      <Button mt="3" size="sm" variant="ghost" w="full" rounded="lg" color="fg.muted" onClick={() => setDeclined(true)}>
        I do not agree
      </Button>
    </Box>
  );
}

export function ConsentPage({ onAgree, door = "university" }: {
  onAgree: (record: ConsentRecord) => void;
  /** Which door (since 6 October 2026): the Prolific door gets Prolific's terms; the university's is unchanged. */
  door?: RecruitmentSource;
}) {
  const prolific = door === "prolific";
  const [checked, setChecked] = useState(false);
  /*
   * Deliberately a SECOND tick, not folded into the first. The payment rules are the part a
   * participant is most likely to skim and most likely to dispute later, so agreement to them is
   * recorded as its own deliberate act rather than bundled into a general "I agree".
   */
  const [rulesChecked, setRulesChecked] = useState(false);
  const bothAgreed = checked && rulesChecked;

  const handleContinue = () => {
    if (!bothAgreed) return;
    onAgree({
      agreed: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
      /* Recorded separately, because it answers a different question than "did they consent":
         it answers "were they told the payment rules before they started". */
      compensation_rules_agreed: true,
    });
  };

  return (
    <Box
      minH="100dvh"
      bg="bg"
      px={{ base: "4", md: "6" }}
      py={{ base: "8", md: "12" }}
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
    >
      <VStack
        gap={{ base: "6", md: "8" }}
        align="stretch"
        maxW="3xl"
        w="full"
        animationName="fade-in"
        animationDuration="moderate"
      >
        {/* Header */}
        <VStack gap="2" textAlign="center">
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="fg.subtle"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Please read before you decide
          </Text>
          <Heading size={{ base: "xl", md: "2xl" }} color="fg" letterSpacing="tight">
            Informed Consent
          </Heading>
          <Text fontSize="sm" color="fg.muted" maxW="xl">
            This page explains what the study involves, what we collect, and what you get. Taking
            part is your choice.
          </Text>
        </VStack>

        {/* The document */}
        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          rounded="2xl"
          p={{ base: "5", md: "7" }}
        >
          <Stack gap="6">
            <Section title="Study Title">
              <Text color="fg" fontWeight="semibold">
                Human-AI Moral Value Study
              </Text>
            </Section>

            <Separator />

            <Section title="Purpose of the Study">
              <Text>
                This study looks at how people make moral choices when every option costs
                something, and how a computer system can support those choices{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  without pushing you toward an answer
                </Text>
                .
              </Text>
              <Text>
                We are interested in your own values and how you apply them when situations
                change. There are no right or wrong answers, and we are not testing your ability.
              </Text>
            </Section>

            <Section title="What You Will Do">
              <Text>The study runs in your web browser and has five parts:</Text>
              <VStack align="stretch" gap="2" pl="1">
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    1. Short question blocks.
                  </Text>{" "}
                  A series of everyday choices that help the system learn what matters to you.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    2. Five emergency situations.
                  </Text>{" "}
                  In each one you see six possible actions and choose the one you would really
                  take. Afterwards you see what your choice meant for the people it affected, and
                  you may keep your choice or change it. Both are fine.
                </Text>
                {/*
                  THE PREDICTION STEP IS DESCRIBED BEFORE THEY AGREE, not discovered on the day.
                  It is the one part of the study where the software makes a claim about the
                  participant to their face, and a person is entitled to know that is coming.

                  The wording does two jobs. It says the guess arrives AFTER their choice, so
                  nobody expects to be steered while deciding. And it says plainly that the guess
                  can be wrong and that they are not being marked, because the obvious way to
                  misread a percentage about yourself is as a score you passed or failed.
                */}
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    3. One last situation, and a guess about you.
                  </Text>{" "}
                  This one is different. You write a rule before you know who you will be in the
                  situation. After you choose, our{" "}
                  <Text as="span" color="fg" fontWeight="semibold">
                    Moral Prediction Function (MPF)
                  </Text>{" "}
                  shows you what it expected you to pick, as a percentage for each option. Then we
                  ask whether the guess sounds like you, and you may keep your answer or change it.
                  The MPF may well be wrong. It is a test of our software, not a test of you.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    4. Your results.
                  </Text>{" "}
                  A summary of the choices you made and the values behind them.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    5. Feedback questions.
                  </Text>{" "}
                  A few questions about your experience of taking part.
                </Text>
              </VStack>
              <Text>
                The whole study takes about{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  40 to 55 minutes
                </Text>
                {prolific ? ". Please complete it in one sitting — see below." : ". You do not have to finish in one sitting — see below."}
              </Text>
            </Section>

            {/*
              ONE SENTENCE, AND NOT A WORD ABOUT THE EMAIL.
              This panel used to explain that the email is what lets the study recognize a
              returning participant. "Privacy and Your Email" below already gives the complete
              reason the address is collected, and saying it twice made the shorter version read as
              a second, separate purpose. The address is explained in exactly one place.
            */}
            {prolific ? <ProlificSitting /> : (
            <Highlight icon={<LuArrowRight />} title="You Can Stop and Come Back">
              <Text>
                You may close the study at any time and return later to continue from where you
                stopped. Your answers are saved, and you can even continue on a different computer.
              </Text>
            </Highlight>
            )}

            {/*
              THE PAYMENT, AND THE RULES OF IT, IN ONE PANEL.
              These were two panels: what you get, then how it is earned. Split across two boxes
              they repeated each other - both named the feedback questions, both mentioned finishing
              across several visits - and the softer of the two came first, so the conditions read
              as an afterthought to a promise already made.

              They are one thing and are now one panel, and it keeps the strong border and its own
              tick-box because it is the section a participant could later say they had not seen. If
              time is a condition of payment they are entitled to know it in advance, and a rule
              agreed to beforehand is far easier to apply afterwards than one produced at the end.
            */}
            {prolific ? <ProlificPayment /> : (
            <Box
              borderWidth="2px"
              borderColor="orange.solid"
              bg="orange.subtle"
              rounded="xl"
              p={{ base: "4", md: "5" }}
            >
              <HStack gap="2.5" mb="3" align="center">
                <Icon boxSize="5" color="orange.fg">
                  <LuGift />
                </Icon>
                <Heading size="sm" color="fg" letterSpacing="tight">
                  Your $5 Amazon Gift Card
                </Heading>
              </HStack>

              <Text fontSize="sm" color="fg.muted" lineHeight="tall">
                Everyone who completes the study receives a{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  $5 Amazon gift card
                </Text>
                , sent privately by email.
              </Text>

              <HStack gap="2.5" mt="4" mb="3" align="center">
                <Icon boxSize="4" color="orange.fg">
                  <LuClock />
                </Icon>
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color="orange.fg"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  What earns it
                </Text>
              </HStack>

              <VStack align="stretch" gap="3" fontSize="sm" color="fg.muted" lineHeight="tall">
                <Rule title="Reach the end.">
                  Answer the feedback questions and arrive at the thank-you page. That is the point
                  at which the study counts as complete.
                </Rule>
                <Rule title={`Spend at least ${REQUIRED_ACTIVE_MINUTES} minutes actively working.`}>
                  Your time adds up across every visit, so you do not have to do it in one sitting.
                </Rule>
                <Rule title="Time counts only while you are working.">
                  If you step away or switch to something else, the study pauses and starts again
                  when you return. Leaving it open while you do something else does not count.
                </Rule>
                <Rule title="Answer thoughtfully.">
                  Rushing through, or giving the same answer to every question, may not qualify.
                </Rule>
                {/* Since 29 September 2026 (the researcher's "Q2-yes"; attentionChecks.ts). */}
                <Rule title="Answer the quick attention checks as asked.">
                  A few simple questions only check that you are reading. Answer all of them as asked to qualify.
                </Rule>
              </VStack>
            </Box>
            )}

            {prolific ? <ProlificPrivacy /> : (
            <Highlight icon={<LuLock />} title="Privacy and Your Email">
              <Text color="fg" fontWeight="semibold">
                This study is confidential, not anonymous.
              </Text>
              <Text>
                We collect your email address for two reasons only: so you can return and finish
                the study, and so we can send your gift card.
              </Text>
              <Text>
                Your email is stored separately from your answers and is seen only by the research
                team. It is never shared, never sold, and never shown to anyone else taking part.
                Your answers are analyzed and reported as group results, so no individual can be
                identified in anything we publish.
              </Text>
              <Text>
                Data is kept on secure, password-protected storage accessible only to the research
                team.
              </Text>
            </Highlight>
            )}

            <Section title="Possible Risks">
              <Text>
                There are no known risks beyond normal computer use. Some of the situations
                describe difficult choices where somebody is worse off whatever you decide, and a
                few people may find this uncomfortable or tiring. You can pause or stop at any
                time, for any reason.
              </Text>
            </Section>

            <Section title="Possible Benefits">
              <Text>
                Taking part helps researchers design decision-support systems that respect a
                person's own values instead of overriding them. You may also find it interesting
                to see how your own choices and values are summarized at the end.
              </Text>
            </Section>

            <Section title="Taking Part Is Voluntary">
              <Text>
                {prolific
                  ? "Your participation is completely voluntary. There is no penalty for not taking part: if you decide not to, please return the study on Prolific."
                  : "Your participation is completely voluntary. There is no penalty for not taking part, and you may skip questions you do not wish to answer."}
              </Text>
            </Section>

            <Section title="Your Right to Withdraw">
              <Text>
                {prolific
                  ? "You may stop at any time, without giving a reason and without consequence, by returning the study on Prolific. If you would like your data removed after taking part, send the researcher a message through Prolific, or email the researcher below, with your Prolific ID, and it will be deleted."
                  : "You may stop at any time, without giving a reason and without consequence. If you would like your data removed after taking part, contact the researcher below and it will be deleted."}
              </Text>
            </Section>

            <Section title="Who to Contact With Questions">
              <Box bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" rounded="xl" p="4">
                <Stack gap="4">
                  <VStack align="start" gap="0.5">
                    <Text color="fg" fontWeight="semibold" fontSize="sm">
                      About the study
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {CONTACT.researcher.name}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {CONTACT.researcher.unit}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {CONTACT.researcher.school}
                    </Text>
                    <Link
                      href={`mailto:${CONTACT.researcher.email}`}
                      fontSize="sm"
                      color="fg"
                      textDecoration="underline"
                    >
                      {CONTACT.researcher.email}
                    </Link>
                  </VStack>
                  <VStack align="start" gap="0.5">
                    <Text color="fg" fontWeight="semibold" fontSize="sm">
                      About your rights as a research participant
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {CONTACT.irb.name}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {CONTACT.irb.address}
                    </Text>
                    <Link
                      href={`mailto:${CONTACT.irb.email}`}
                      fontSize="sm"
                      color="fg"
                      textDecoration="underline"
                    >
                      {CONTACT.irb.email}
                    </Link>
                  </VStack>
                </Stack>
              </Box>
            </Section>
          </Stack>
        </Box>

        {/* Agreement - the Prolific door's own (one box, and "I do not agree") */}
        {prolific ? <ProlificAgreement onAgree={onAgree} /> : (
        <Box
          borderWidth="2px"
          borderColor={checked ? "green.solid" : "border.emphasized"}
          bg="bg.panel"
          rounded="2xl"
          p={{ base: "5", md: "6" }}
          transition="border-color 0.2s ease"
        >
          <HStack gap="2.5" mb="3" align="center">
            <Icon boxSize="4" color={checked ? "green.fg" : "fg.subtle"}>
              <LuShieldCheck />
            </Icon>
            <Heading size="sm" color="fg" letterSpacing="tight">
              Agreement
            </Heading>
          </HStack>

          <Checkbox
            checked={checked}
            onCheckedChange={(e) => setChecked(!!e.checked)}
            colorPalette="green"
            alignItems="flex-start"
            cursor="pointer"
          >
            <Text fontSize="sm" color="fg" lineHeight="tall">
              I have read the procedure described above. I voluntarily agree to take part, and I
              understand that my email address will be collected so I can return to finish the
              study and receive the gift card.
            </Text>
          </Checkbox>

          <Box mt="4" pt="4" borderTopWidth="1px" borderColor="border.subtle">
            <Checkbox
              checked={rulesChecked}
              onCheckedChange={(e) => setRulesChecked(!!e.checked)}
              colorPalette="orange"
              alignItems="flex-start"
              cursor="pointer"
            >
              <Text fontSize="sm" color="fg" lineHeight="tall">
                I understand how the gift card is earned: at least{" "}
                <Text as="span" fontWeight="bold">
                  {REQUIRED_ACTIVE_MINUTES} minutes of active work
                </Text>{" "}
                plus the feedback questions, that time counts only while I am actually working, that
                rushing may not qualify, and that I must answer the attention checks as asked.
              </Text>
            </Checkbox>
          </Box>

          <Button
            mt="5"
            size="lg"
            w="full"
            colorPalette="green"
            bg={bothAgreed ? "green.solid" : "bg.muted"}
            color={bothAgreed ? "green.contrast" : "fg.subtle"}
            _hover={bothAgreed ? { opacity: 0.92 } : {}}
            rounded="lg"
            fontWeight="semibold"
            gap="2"
            disabled={!bothAgreed}
            onClick={handleContinue}
          >
            I agree — continue
            <Icon boxSize="4">
              <LuArrowRight />
            </Icon>
          </Button>

          {!bothAgreed && (
            <Text mt="2.5" fontSize="xs" color="fg.subtle" textAlign="center">
              Tick both boxes above to continue.
            </Text>
          )}
        </Box>
        )}
      </VStack>
    </Box>
  );
}
