import { Box, Container, Heading, Text, VStack } from '@chakra-ui/react'
import Head from 'next/head'
import { useState } from 'react'
import { GoalInput } from '@/components/GoalInput'
import { ResultsDisplay } from '@/components/ResultsDisplay'
import type { NextPage } from 'next'

const Home: NextPage = () => {
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleGoalSubmit = async (goal: string) => {
    setIsLoading(true)
    try {
      // TODO: Implement goal processing
      setResults([])
    } catch (error) {
      console.error('Error processing goal:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Lead Generation Platform</title>
        <meta name="description" content="AI-powered lead generation and outreach platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Box as="main" py={10}>
        <Container maxW="container.xl">
          <VStack spacing={8} align="stretch">
            <Box textAlign="center">
              <Heading as="h1" size="2xl" mb={4}>
                Lead Generation Platform
              </Heading>
              <Text fontSize="xl" color="gray.600">
                Discover and connect with potential clients using AI
              </Text>
            </Box>

            <GoalInput onSubmit={handleGoalSubmit} isLoading={isLoading} />

            <ResultsDisplay results={results} isLoading={isLoading} />
          </VStack>
        </Container>
      </Box>
    </>
  )
}

export default Home 