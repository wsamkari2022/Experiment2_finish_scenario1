/**
 * ConsentPage.tsx — informed consent, shown once, before anything else.
 *
 * PROLIFIC ONLY (since 10 November 2026). The IRB refused the student group on 9 November 2026, so there is one consent
 * page, and it says word for word what the Prolific consent form sent to the IRB says ("Informed Consent, Prolific
 * version", 27 October 2026; docs/PROLIFIC_CONSENT_FORM_TEXT.txt holds its text and validate:attention T10 compares the page
 * with it, sentence by sentence). If the IRB changes a word, change it in both places and move PROLIFIC_CONSENT_VERSION.
 * Deploy only after the IRB approves. The student page is in the Git tag before-prolific-only.
 *
 * WHY THE PAGE IS LONG. The study is confidential, not anonymous (the Prolific ID is stored with the answers), and the
 * payment part carries promises a participant relies on: $12 an hour, how Prolific pays, when a submission can be rejected
 * and when it never is, and what happens after a technical problem. The daily pay check (tools/pay_check.cjs) keeps those
 * promises, so a change here may need a change there.
 *
 * PROLIFIC_CONSENT_VERSION
 * Stamped onto every consent record. If this text is ever edited, move it. Without a version you cannot say which wording
 * a given participant actually agreed to, which is the first question asked when a consent form changes mid-study.
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
import {
  LuArrowRight,
  LuCheck,
  LuClock,
  LuLock,
  LuShieldCheck,
  LuUndo2,
  LuWallet,
} from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";

/** Move this whenever the wording below changes. Stored with every consent record. "2026-11-10-prolific-only-12-an-hour" is
 *  the form sent to the IRB after it refused the student group. */
export const PROLIFIC_CONSENT_VERSION = "2026-11-10-prolific-only-12-an-hour";

/** What a participant agreed to, and when. Written to storage by the caller. */
export interface ConsentRecord {
  agreed: boolean;
  timestamp: string;
  version: string;
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
    name: "Samuel Monzem, Ph.D., Chair, Institutional Review Board",
    unit: "Office of Sponsored Research, Florida Institute of Technology",
    address: "150 W. University Blvd., Melbourne, Florida 32901",
    email: "smonzem@fit.edu",
    phone: "321.674.7377",
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

/* ------------------------------------------------------------------------------------- PROLIFIC'S TERMS */

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

/** The payment through Prolific, what completes the study, and how Prolific pays. */
const HOW_PROLIFIC_PAYS = [
  "Everyone who completes the study receives the same reward, the amount shown in the study on Prolific, however long they take.",
  "If most people take much longer than the study's estimate, the reward is raised for everyone, as Prolific requires.",
  "We review each submission, normally within a few days. If we have not, Prolific approves it automatically after 22 days, and the reward goes to your Prolific account.",
  "If you stop early and return the study, you are not paid. If you finish after Prolific's time limit, we still approve and pay you when our records show that you completed the study.",
  "A submission is rejected if two or more of the attention checks are failed. Otherwise it may be rejected only for the other reasons Prolific allows: clear low effort throughout, or finishing exceptionally fast. It is never rejected for being slow or because of a technical problem.",
  "If a technical problem on our side stops you, we pay you for your time.",
] as const;

const MORE_FROM_PROLIFIC = [
  { title: "When will I be paid for a study?", url: "https://participant-help.prolific.com/en/articles/445059-when-will-i-be-paid-for-a-study" },
  { title: "Underpaying studies:", url: "https://participant-help.prolific.com/en/articles/445043-underpaying-studies" },
  { title: "Why does my submission show as timed-out?", url: "https://participant-help.prolific.com/en/articles/445044-why-does-my-submission-show-as-timed-out" },
] as const;

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
        You will be paid through Prolific at a rate equivalent to{" "}
        <Text as="span" color="fg" fontWeight="semibold">
          US$12 per hour
        </Text>
        , based on the study&apos;s estimated completion time. The total reward is shown on Prolific before you begin. Every
        submission is reviewed before payment.
      </Text>
      <HStack gap="2.5" mt="4" mb="3" align="center">
        <Icon boxSize="4" color="orange.fg">
          <LuCheck />
        </Icon>
        <Text fontSize="xs" fontWeight="bold" color="orange.fg" textTransform="uppercase" letterSpacing="wider">
          What completes it:
        </Text>
      </HStack>
      <VStack align="stretch" gap="3" fontSize="sm" color="fg.muted" lineHeight="tall">
        <Rule title="Reach the end.">
          Answer the feedback questions and arrive at the final page. There you receive your completion code, and a
          button takes you back to Prolific.
        </Rule>
        <Rule title="Answer the attention checks as asked.">
          A few simple questions check that you are reading. If you fail two or more of them, your submission will be
          rejected.
        </Rule>
        <Rule title="Answer thoughtfully.">
          A submission that shows clear low effort throughout, such as the same answer to every question, may be
          rejected.
        </Rule>
      </VStack>
      <Text mt="4" mb="2" fontSize="xs" fontWeight="bold" color="orange.fg" textTransform="uppercase" letterSpacing="wider">
        How Prolific pays (Prolific&apos;s own rules):
      </Text>
      <Box as="ul" data-how-prolific-pays listStyleType="disc" pl="5" fontSize="sm" color="fg.muted" lineHeight="tall">
        {HOW_PROLIFIC_PAYS.map((line) => (
          <Box as="li" key={line} mb="1.5">
            {line}
          </Box>
        ))}
      </Box>
      <Text mt="3" fontSize="sm" color="fg" fontWeight="semibold">
        More from Prolific:
      </Text>
      <VStack data-more-from-prolific align="stretch" gap="1.5" mt="1" fontSize="sm" color="fg.muted" lineHeight="tall">
        {MORE_FROM_PROLIFIC.map((item) => (
          <Text key={item.url}>
            {item.title}{" "}
            <Link href={item.url} target="_blank" rel="noopener noreferrer" color="fg" textDecoration="underline" wordBreak="break-all">
              {item.url}
            </Link>
          </Text>
        ))}
      </VStack>
    </Box>
  );
}

/** Privacy: the Prolific ID, how long the data is kept, and how to see or delete it. */
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
      <Text>
        Your answers are stored on a secure Florida Tech server in the United States and kept for five years after the
        study ends, then deleted. You may ask to see your data, or to have it deleted, at any time: send the researcher a
        message through Prolific with your Prolific ID.
      </Text>
    </Highlight>
  );
}

/** The agreement: one box, and a way to decline that says how to return the study. */
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
        I agree - continue
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

export function ConsentPage({ onAgree }: { onAgree: (record: ConsentRecord) => void }) {

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
                The whole study takes{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  at least 35 minutes
                </Text>
                . Please complete it in one sitting - see below.
              </Text>
            </Section>

            <ProlificSitting />

            <ProlificPayment />

            <ProlificPrivacy />

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
                Your participation is completely voluntary. There is no penalty for not taking part: if you decide not to,
                please return the study on Prolific.
              </Text>
            </Section>

            <Section title="Your Right to Withdraw">
              <Text>
                You may stop at any time, without giving a reason and without consequence, by returning the study on
                Prolific. If you would like your data removed after taking part, send the researcher a message through
                Prolific, or email the researcher below, with your Prolific ID, and it will be deleted.
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
                      {CONTACT.irb.unit}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {CONTACT.irb.address}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      Email:{" "}
                      <Link href={`mailto:${CONTACT.irb.email}`} color="fg" textDecoration="underline">
                        {CONTACT.irb.email}
                      </Link>
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      Phone: {CONTACT.irb.phone}
                    </Text>
                  </VStack>
                </Stack>
              </Box>
            </Section>
          </Stack>
        </Box>

        <ProlificAgreement onAgree={onAgree} />
      </VStack>
    </Box>
  );
}
