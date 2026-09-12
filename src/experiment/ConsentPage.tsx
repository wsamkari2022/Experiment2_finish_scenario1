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
import { LuArrowRight, LuClock, LuGift, LuLock, LuShieldCheck } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import { REQUIRED_ACTIVE_MINUTES } from "./dbShape";

/** Bump whenever the consent wording below changes. Stored with every consent record. */
export const CONSENT_VERSION = "2026-09-11";

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

export function ConsentPage({ onAgree }: { onAgree: (record: ConsentRecord) => void }) {
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
              <Text>The study runs in your web browser and has four parts:</Text>
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
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    3. Your results.
                  </Text>{" "}
                  A summary of the choices you made and the values behind them.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    4. Feedback questions.
                  </Text>{" "}
                  A few questions about your experience of taking part.
                </Text>
              </VStack>
              <Text>
                The whole study takes about{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  35 to 50 minutes
                </Text>
                . You do not have to finish in one sitting — see below.
              </Text>
            </Section>

            <Highlight icon={<LuArrowRight />} title="You Can Stop and Come Back">
              <Text>
                You may close the study at any time and return later to continue from where you
                stopped. Your answers so far are saved.
              </Text>
              <Text>
                This is why we ask for your email address on the next page: it is how the study
                recognizes you when you come back.
              </Text>
            </Highlight>

            <Highlight icon={<LuGift />} title="Compensation">
              <Text>
                Participants who complete the entire study will receive a{" "}
                <Text as="span" color="fg" fontWeight="semibold">
                  $5 Amazon gift card
                </Text>
                , sent privately to the email address you provide.
              </Text>
              <Text>
                The study counts as complete once you have submitted the feedback questions at the
                end and reached the thank-you page.
              </Text>
            </Highlight>

            {/*
              THE RULES OF THE PAYMENT, STATED BEFORE THEY AGREE.
              Given its own bordered panel and its own tick-box because it is the one section a
              participant could later say they had not seen. If time is a condition of payment,
              they are entitled to know it in advance — and a rule agreed to in advance is also
              far easier to apply afterwards than one produced at the end.
            */}
            <Box
              borderWidth="2px"
              borderColor="orange.solid"
              bg="orange.subtle"
              rounded="xl"
              p={{ base: "4", md: "5" }}
            >
              <HStack gap="2.5" mb="3" align="center">
                <Icon boxSize="5" color="orange.fg">
                  <LuClock />
                </Icon>
                <Heading size="sm" color="fg" letterSpacing="tight">
                  How the gift card is earned
                </Heading>
              </HStack>

              <VStack align="stretch" gap="3" fontSize="sm" color="fg.muted" lineHeight="tall">
                <Text>
                  <Text as="span" color="fg" fontWeight="bold">
                    Spend at least {REQUIRED_ACTIVE_MINUTES} minutes actively working
                  </Text>{" "}
                  on the study, and answer every feedback question at the end.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    You may finish across several visits.
                  </Text>{" "}
                  Your time adds up, and you continue exactly where you stopped — even on a
                  different computer.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    Time counts only while you are actually working.
                  </Text>{" "}
                  If you step away or switch to something else, the study pauses and starts again
                  when you return. Leaving it open while you do something else does not count.
                </Text>
                <Text>
                  <Text as="span" color="fg" fontWeight="semibold">
                    Please answer thoughtfully.
                  </Text>{" "}
                  Rushing through, or giving the same answer to every question, may not qualify.
                </Text>
              </VStack>
            </Box>

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
                Your participation is completely voluntary. There is no penalty for not taking
                part, and you may skip questions you do not wish to answer.
              </Text>
            </Section>

            <Section title="Your Right to Withdraw">
              <Text>
                You may stop at any time, without giving a reason and without consequence. If you
                would like your data removed after taking part, contact the researcher below and
                it will be deleted.
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

        {/* Agreement */}
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
                plus the feedback questions, that time counts only while I am actually working, and
                that rushing may not qualify.
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
      </VStack>
    </Box>
  );
}
